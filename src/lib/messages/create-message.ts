import "server-only";

import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { AppError } from "@/lib/errors";
import { logError, logInfo } from "@/lib/logging/app-logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import { parseMessageDraft } from "@/lib/validation/message";

import { getOrCreateCurrentProfile } from "@/lib/profile/profile-service";
import { uploadChatImage } from "./upload-chat-image";
import { buildPreviewText } from "./reply-preview";

const MESSAGE_RATE_LIMIT_WINDOW_MS = 60_000;
const MESSAGE_RATE_LIMIT_MAX = 20;
const IMAGE_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const IMAGE_RATE_LIMIT_MAX = 10;
const MESSAGE_RATE_LIMIT_ERROR = "Вы отправляете сообщения слишком часто";
const MESSAGE_CREATE_ERROR = "Не удалось отправить сообщение. Попробуйте позже";

type MessageRow = {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_display_name: string | null;
  text: string | null;
  image_path: string | null;
  image_mime_type: string | null;
  image_size_bytes: number | null;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
  reply_to_message_id: string | null;
  reply_to_sender_id: string | null;
  reply_to_sender_name: string | null;
  reply_to_preview_text: string | null;
  reply_to_has_image: boolean | null;
};

/** Строка исходного сообщения для нормализации reply snapshot. */
type SourceMessageRow = {
  id: string;
  sender_id: string;
  sender_display_name: string | null;
  sender_email: string;
  text: string | null;
  image_path: string | null;
};

export type CreatedMessage = {
  id: string;
  senderId: string;
  senderEmail: string;
  senderDisplayName: string | null;
  text: string | null;
  imagePath: string | null;
  imageMimeType: string | null;
  imageSizeBytes: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
  replyToMessageId: string | null;
  replyToSenderId: string | null;
  replyToSenderName: string | null;
  replyToPreviewText: string | null;
  replyToHasImage: boolean | null;
};

export type CreateMessageInput = {
  text?: string | null;
  imageFile?: File | null;
  /** Reply payload из composer (C2 реализует запись в БД). */
  replyToMessageId?: string | null;
  replyToSenderId?: string | null;
  replyToSenderName?: string | null;
  replyToPreviewText?: string | null;
  replyToHasImage?: boolean;
};

function mapMessageRow(row: MessageRow): CreatedMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderEmail: row.sender_email,
    senderDisplayName: row.sender_display_name,
    text: row.text,
    imagePath: row.image_path,
    imageMimeType: row.image_mime_type,
    imageSizeBytes: row.image_size_bytes,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    createdAt: row.created_at,
    replyToMessageId: row.reply_to_message_id ?? null,
    replyToSenderId: row.reply_to_sender_id ?? null,
    replyToSenderName: row.reply_to_sender_name ?? null,
    replyToPreviewText: row.reply_to_preview_text ?? null,
    replyToHasImage: row.reply_to_has_image ?? false,
  };
}

type ReplyInsertPayload = {
  reply_to_message_id: string | null;
  reply_to_sender_id: string | null;
  reply_to_sender_name: string | null;
  reply_to_preview_text: string | null;
  reply_to_has_image: boolean | null;
};

async function fetchSourceMessage(
  messageId: string,
): Promise<SourceMessageRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,sender_display_name,sender_email,text,image_path")
    .eq("id", messageId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SourceMessageRow;
}

function toSourceSenderName(row: SourceMessageRow): string {
  const name =
    row.sender_display_name?.trim() && row.sender_display_name.trim().length > 0
      ? row.sender_display_name.trim()
      : row.sender_email;
  return name;
}

async function computeReplyInsertPayload(input: CreateMessageInput): Promise<ReplyInsertPayload> {
  const hasClientReply =
    (input.replyToMessageId?.trim()?.length ?? 0) > 0 ||
    (input.replyToSenderId?.trim()?.length ?? 0) > 0 ||
    (input.replyToSenderName?.trim()?.length ?? 0) > 0;

  if (!hasClientReply) {
    return {
      reply_to_message_id: null,
      reply_to_sender_id: null,
      reply_to_sender_name: null,
      reply_to_preview_text: null,
      reply_to_has_image: null,
    };
  }

  const replyToMessageId = input.replyToMessageId?.trim() || null;

  if (replyToMessageId) {
    const source = await fetchSourceMessage(replyToMessageId);
    if (source) {
      const senderName = toSourceSenderName(source);
      const hasImage = source.image_path != null;
      const previewText = buildPreviewText(source.text, hasImage);
      return {
        reply_to_message_id: source.id,
        reply_to_sender_id: source.sender_id,
        reply_to_sender_name: senderName,
        reply_to_preview_text: previewText,
        reply_to_has_image: hasImage,
      };
    }
  }

  return {
    reply_to_message_id: null,
    reply_to_sender_id: input.replyToSenderId?.trim() || null,
    reply_to_sender_name: input.replyToSenderName?.trim() || null,
    reply_to_preview_text: input.replyToPreviewText ?? null,
    reply_to_has_image: input.replyToHasImage ?? false,
  };
}

function toWindowStartIso(windowMs: number): string {
  return new Date(Date.now() - windowMs).toISOString();
}

function normalizeImageFile(file?: File | null): File | null {
  if (!(file instanceof File)) {
    return null;
  }

  if (file.size === 0) {
    return null;
  }

  return file;
}

function getMessageLogFields(params: {
  userId: string;
  userEmail: string;
  text: string | null | undefined;
  imageFile: File | null;
  uploadedImage:
    | {
        path: string;
        mimeType: string;
        sizeBytes: number;
        width: number;
        height: number;
      }
    | null;
}): Record<string, string | number | boolean | null> {
  const trimmedText = params.text?.trim() ?? "";

  return {
    userId: params.userId,
    email: params.userEmail,
    hasText: trimmedText.length > 0,
    textLength: trimmedText.length,
    hasImage: Boolean(params.imageFile),
    imageMimeType: params.uploadedImage?.mimeType ?? params.imageFile?.type ?? null,
    imageSizeBytes: params.uploadedImage?.sizeBytes ?? params.imageFile?.size ?? null,
    imageWidth: params.uploadedImage?.width ?? null,
    imageHeight: params.uploadedImage?.height ?? null,
    imagePath: params.uploadedImage?.path ?? null,
  };
}

async function checkMessageRateLimit(senderId: string, hasImage: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const recentMessagesQuery = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", senderId)
    .gte("created_at", toWindowStartIso(MESSAGE_RATE_LIMIT_WINDOW_MS));

  const recentImageMessagesQuery = hasImage
    ? supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", senderId)
        .not("image_path", "is", null)
        .gte("created_at", toWindowStartIso(IMAGE_RATE_LIMIT_WINDOW_MS))
    : null;

  const [{ error: messageCountError, count: messageCount }, imageCountResult] = await Promise.all([
    recentMessagesQuery,
    recentImageMessagesQuery,
  ]);

  if (messageCountError) {
    throw mapSupabaseError(messageCountError);
  }

  if ((messageCount ?? 0) >= MESSAGE_RATE_LIMIT_MAX) {
    throw new AppError({
      code: "RATE_LIMIT",
      publicMessage: MESSAGE_RATE_LIMIT_ERROR,
    });
  }

  if (!hasImage) {
    return;
  }

  const imageCountError = imageCountResult?.error ?? null;
  const imageCount = imageCountResult?.count ?? 0;

  if (imageCountError) {
    throw mapSupabaseError(imageCountError);
  }

  if (imageCount >= IMAGE_RATE_LIMIT_MAX) {
    throw new AppError({
      code: "RATE_LIMIT",
      publicMessage: MESSAGE_RATE_LIMIT_ERROR,
    });
  }
}

async function cleanupUploadedImage(path: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.storage.from("chat-images").remove([path]);
  } catch {
    // noop: orphan cleanup is best-effort only
  }
}

export async function createMessage(input: CreateMessageInput): Promise<CreatedMessage> {
  const user = await requireConfirmedUser();
  const imageFile = normalizeImageFile(input.imageFile);

  await checkMessageRateLimit(user.id, Boolean(imageFile));

  let uploadedImage: Awaited<ReturnType<typeof uploadChatImage>> | null = null;

  try {
    if (imageFile) {
      uploadedImage = await uploadChatImage(imageFile);
    }

    const draft = parseMessageDraft({
      text: input.text,
      image: uploadedImage,
    });

    const profile = await getOrCreateCurrentProfile();
    const senderDisplayName =
      (profile.displayName?.trim() && profile.displayName.trim().length > 0)
        ? profile.displayName.trim()
        : user.email;

    const replyPayload = await computeReplyInsertPayload(input);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        sender_email: user.email,
        sender_display_name: senderDisplayName,
        text: draft.text,
        image_path: draft.image?.path ?? null,
        image_mime_type: draft.image?.mimeType ?? null,
        image_size_bytes: draft.image?.sizeBytes ?? null,
        image_width: draft.image?.width ?? null,
        image_height: draft.image?.height ?? null,
        ...replyPayload,
      })
      .select(
        "id,sender_id,sender_email,sender_display_name,text,image_path,image_mime_type,image_size_bytes,image_width,image_height,created_at,reply_to_message_id,reply_to_sender_id,reply_to_sender_name,reply_to_preview_text,reply_to_has_image",
      )
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    logInfo("chat.message_send_succeeded", {
      ...getMessageLogFields({
        userId: user.id,
        userEmail: user.email,
        text: draft.text,
        imageFile,
        uploadedImage,
      }),
      messageId: data.id,
    });

    return mapMessageRow(data as MessageRow);
  } catch (error) {
    if (uploadedImage?.path) {
      await cleanupUploadedImage(uploadedImage.path);
    }

    logError(
      "chat.message_send_failed",
      error,
      getMessageLogFields({
        userId: user.id,
        userEmail: user.email,
        text: input.text,
        imageFile,
        uploadedImage,
      }),
    );

    if (error instanceof AppError) {
      if (error.code === "VALIDATION" || error.code === "RATE_LIMIT") {
        throw error;
      }

      throw new AppError({
        code: error.code,
        publicMessage: MESSAGE_CREATE_ERROR,
        cause: error,
      });
    }

    throw new AppError({
      code: "UPSTREAM",
      publicMessage: MESSAGE_CREATE_ERROR,
      cause: error,
    });
  }
}
