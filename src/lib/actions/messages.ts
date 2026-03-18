"use server";

import { revalidatePath } from "next/cache";

import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { AppError } from "@/lib/errors";
import { listMessagesAfterCursor, listMessagesPage, type MessageListCursor } from "@/lib/messages/list-messages";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMessage } from "@/lib/messages/create-message";
import { renderMessageForChat, renderMessagesForChat } from "@/lib/messages/render-message";
import type { RenderedMessage } from "@/lib/messages/rendered-message";

export type MessageComposerState = {
  success: boolean;
  error: string | null;
};

export type CreateMessageFormActionResult = MessageComposerState & {
  message: RenderedMessage | null;
};

type HydrateRealtimeMessageInput = {
  id: string;
  senderId: string;
  senderEmail: string;
  senderDisplayName?: string | null;
  text: string | null;
  imagePath: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

type MessageCursorInput = {
  createdAt: string;
  id: string;
};

function getOptionalImageFile(formData: FormData): File | null {
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return null;
  }

  if (image.size === 0) {
    return null;
  }

  return image;
}

/** Reply payload из формы (опционально). */
type ReplyFormPayload = {
  replyToMessageId: string | null;
  replyToSenderId: string | null;
  replyToSenderName: string | null;
  replyToPreviewText: string | null;
  replyToHasImage: boolean;
};

function getOptionalReplyPayload(formData: FormData): ReplyFormPayload | null {
  const messageId = formData.get("replyToMessageId");
  const senderId = formData.get("replyToSenderId");
  const senderName = formData.get("replyToSenderName");
  const previewText = formData.get("replyToPreviewText");
  const hasImageRaw = formData.get("replyToHasImage");

  const hasAny =
    (typeof messageId === "string" && messageId.trim().length > 0) ||
    (typeof senderId === "string" && senderId.trim().length > 0) ||
    (typeof senderName === "string" && senderName.trim().length > 0) ||
    (typeof previewText === "string") ||
    hasImageRaw !== null;

  if (!hasAny) return null;

  const replyToHasImage =
    hasImageRaw === "true" || hasImageRaw === "1" || (typeof hasImageRaw === "string" && hasImageRaw.toLowerCase() === "true");

  return {
    replyToMessageId: typeof messageId === "string" ? messageId.trim() || null : null,
    replyToSenderId: typeof senderId === "string" ? senderId.trim() || null : null,
    replyToSenderName: typeof senderName === "string" ? senderName.trim() || null : null,
    replyToPreviewText: typeof previewText === "string" ? previewText : null,
    replyToHasImage,
  };
}

export async function createMessageFormAction(
  _previousState: MessageComposerState,
  formData: FormData,
): Promise<CreateMessageFormActionResult> {
  const text = (formData.get("text") ?? "") as string;
  const imageFile = getOptionalImageFile(formData);
  const replyPayload = getOptionalReplyPayload(formData);

  try {
    const createdMessage = await createMessage({
      text,
      imageFile,
      ...(replyPayload && {
        replyToMessageId: replyPayload.replyToMessageId,
        replyToSenderId: replyPayload.replyToSenderId,
        replyToSenderName: replyPayload.replyToSenderName,
        replyToPreviewText: replyPayload.replyToPreviewText,
        replyToHasImage: replyPayload.replyToHasImage,
      }),
    });
    const senderName = toSenderName(createdMessage.senderDisplayName, createdMessage.senderEmail);
    const renderedMessage = await renderMessageForChat({
      id: createdMessage.id,
      senderId: createdMessage.senderId,
      senderName,
      text: createdMessage.text,
      imagePath: createdMessage.imagePath,
      createdAt: createdMessage.createdAt,
      updatedAt: null,
      replyToMessageId: createdMessage.replyToMessageId,
      replyToSenderId: createdMessage.replyToSenderId,
      replyToSenderName: createdMessage.replyToSenderName,
      replyToPreviewText: createdMessage.replyToPreviewText,
      replyToHasImage: createdMessage.replyToHasImage,
    });

    revalidatePath("/chat");

    return {
      success: true,
      error: null,
      message: renderedMessage,
    };
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNEXPECTED",
            publicMessage: "Не удалось отправить сообщение. Попробуйте позже",
            cause: error,
          });

    return {
      success: false,
      error: appError.publicMessage,
      message: null,
    };
  }
}

function isHydrateRealtimeMessageInput(value: unknown): value is HydrateRealtimeMessageInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  const senderDisplayName = (candidate as HydrateRealtimeMessageInput).senderDisplayName;

  const updatedAt = (candidate as HydrateRealtimeMessageInput).updatedAt;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.senderId === "string" &&
    typeof candidate.senderEmail === "string" &&
    typeof candidate.createdAt === "string" &&
    (typeof candidate.text === "string" || candidate.text === null) &&
    (typeof candidate.imagePath === "string" || candidate.imagePath === null) &&
    (updatedAt === undefined || updatedAt === null || typeof updatedAt === "string") &&
    (senderDisplayName === undefined ||
      senderDisplayName === null ||
      typeof senderDisplayName === "string")
  );
}

function toSenderName(displayName: string | null | undefined, email: string): string {
  const trimmed =
    typeof displayName === "string" ? displayName.trim() : "";
  return trimmed.length > 0 ? trimmed : email;
}

function isMessageCursorInput(value: unknown): value is MessageCursorInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.createdAt === "string" && typeof candidate.id === "string";
}

export async function hydrateRealtimeMessageAction(
  input: HydrateRealtimeMessageInput,
): Promise<RenderedMessage | null> {
  try {
    await requireConfirmedUser();

    if (!isHydrateRealtimeMessageInput(input)) {
      return null;
    }

    const senderName = toSenderName(input.senderDisplayName, input.senderEmail);

    return await renderMessageForChat({
      id: input.id,
      senderId: input.senderId,
      senderName,
      text: input.text,
      imagePath: input.imagePath,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt ?? null,
    });
  } catch {
    return null;
  }
}

export async function backfillMessagesAfterCursorAction(
  cursor: MessageCursorInput,
): Promise<RenderedMessage[]> {
  try {
    await requireConfirmedUser();

    if (!isMessageCursorInput(cursor)) {
      return [];
    }

    const messages = await listMessagesAfterCursor(cursor);

    return await renderMessagesForChat(
      messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        text: message.text,
        imagePath: message.imagePath,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        replyToMessageId: message.replyToMessageId,
        replyToSenderId: message.replyToSenderId,
        replyToSenderName: message.replyToSenderName,
        replyToPreviewText: message.replyToPreviewText,
        replyToHasImage: message.replyToHasImage,
      })),
    );
  } catch {
    return [];
  }
}

type LoadOlderMessagesPageInput = {
  cursor: MessageListCursor | null;
};

function isLoadOlderMessagesPageInput(value: unknown): value is LoadOlderMessagesPageInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const cursor = candidate.cursor as unknown;

  if (cursor === null) {
    return true;
  }

  return isMessageCursorInput(cursor);
}

export async function loadOlderMessagesPageAction(input: LoadOlderMessagesPageInput): Promise<{
  messages: RenderedMessage[];
  nextCursor: MessageListCursor | null;
}> {
  try {
    await requireConfirmedUser();

    if (!isLoadOlderMessagesPageInput(input)) {
      return { messages: [], nextCursor: null };
    }

    const page = await listMessagesPage(input.cursor);

    const messages = await renderMessagesForChat(
      page.items.map((item) => ({
        id: item.id,
        senderId: item.senderId,
        senderName: item.senderName,
        text: item.text,
        imagePath: item.imagePath,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        replyToMessageId: item.replyToMessageId,
        replyToSenderId: item.replyToSenderId,
        replyToSenderName: item.replyToSenderName,
        replyToPreviewText: item.replyToPreviewText,
        replyToHasImage: item.replyToHasImage,
      })),
    );

    return {
      messages,
      nextCursor: page.nextCursor,
    };
  } catch {
    return { messages: [], nextCursor: null };
  }
}

const DELETE_MESSAGE_ERROR = "Не удалось удалить сообщение. Попробуйте позже";
const EDIT_MESSAGE_ERROR = "Не удалось сохранить изменения. Попробуйте позже";

export type EditMessageResult = {
  success: boolean;
  error: string | null;
};

export async function editMessageAction(messageId: string, text: string): Promise<EditMessageResult> {
  try {
    const { id: userId } = await requireConfirmedUser();

    if (!messageId?.trim() || typeof text !== "string") {
      return { success: false, error: EDIT_MESSAGE_ERROR };
    }

    const trimmed = text.trim();

    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("messages")
      .select("id, text, sender_id")
      .eq("id", messageId.trim())
      .single();

    if (!existing || existing.sender_id !== userId) {
      return { success: false, error: EDIT_MESSAGE_ERROR };
    }

    if ((existing.text ?? "").trim() === trimmed) {
      revalidatePath("/chat");
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from("messages")
      .update({ text: trimmed, updated_at: new Date().toISOString() })
      .eq("id", messageId.trim())
      .eq("sender_id", userId);

    if (error) {
      console.error("[editMessageAction] Supabase error:", error.message, error.code, error.details);
      const message =
        process.env.NODE_ENV === "development"
          ? `${EDIT_MESSAGE_ERROR} (${error.message})`
          : EDIT_MESSAGE_ERROR;
      return { success: false, error: message };
    }

    revalidatePath("/chat");
    return { success: true, error: null };
  } catch (err) {
    console.error("[editMessageAction] Unexpected error:", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? `${EDIT_MESSAGE_ERROR} (${err.message})`
        : EDIT_MESSAGE_ERROR;
    return { success: false, error: message };
  }
}

export type DeleteMessageResult = {
  success: boolean;
  error: string | null;
};

export async function deleteMessageAction(messageId: string): Promise<DeleteMessageResult> {
  try {
    const { id: userId } = await requireConfirmedUser();

    if (!messageId || typeof messageId !== "string" || messageId.trim() === "") {
      return { success: false, error: DELETE_MESSAGE_ERROR };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId.trim())
      .eq("sender_id", userId);

    if (error) {
      return { success: false, error: DELETE_MESSAGE_ERROR };
    }

    revalidatePath("/chat");
    return { success: true, error: null };
  } catch {
    return { success: false, error: DELETE_MESSAGE_ERROR };
  }
}
