import "server-only";

import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { AppError } from "@/lib/errors";
import { logError, logInfo } from "@/lib/logging/app-logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError } from "@/lib/supabase/map-error";
import { validateImageFile } from "@/lib/validation/image";

const CHAT_IMAGES_BUCKET = "chat-images";
const UPLOAD_GENERIC_ERROR_MESSAGE = "Не удалось отправить сообщение. Попробуйте позже";

export type UploadedChatImage = {
  path: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function buildChatImagePath(senderId: string, suggestedExt: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = padMonth(now.getUTCMonth() + 1);

  return `${senderId}/${year}/${month}/${crypto.randomUUID()}.${suggestedExt}`;
}

function getUploadLogFields(params: {
  userId: string;
  email: string;
  fileType: string | null;
  fileSizeBytes: number | null;
  imagePath?: string | null;
  width?: number | null;
  height?: number | null;
}): Record<string, string | number | null> {
  return {
    userId: params.userId,
    email: params.email,
    fileType: params.fileType,
    fileSizeBytes: params.fileSizeBytes,
    imagePath: params.imagePath ?? null,
    imageWidth: params.width ?? null,
    imageHeight: params.height ?? null,
  };
}

export async function uploadChatImage(file: File): Promise<UploadedChatImage> {
  const user = await requireConfirmedUser();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validatedImage = validateImageFile(buffer, file.type);
    const path = buildChatImagePath(user.id, validatedImage.suggestedExt);

    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from(CHAT_IMAGES_BUCKET).upload(path, buffer, {
      contentType: validatedImage.mimeType,
      upsert: false,
    });

    if (error) {
      throw mapSupabaseError(error);
    }

    logInfo(
      "chat.image_upload_succeeded",
      getUploadLogFields({
        userId: user.id,
        email: user.email,
        fileType: validatedImage.mimeType,
        fileSizeBytes: validatedImage.sizeBytes,
        imagePath: path,
        width: validatedImage.width,
        height: validatedImage.height,
      }),
    );

    return {
      path,
      mimeType: validatedImage.mimeType,
      sizeBytes: validatedImage.sizeBytes,
      width: validatedImage.width,
      height: validatedImage.height,
    };
  } catch (error) {
    logError(
      "chat.image_upload_failed",
      error,
      getUploadLogFields({
        userId: user.id,
        email: user.email,
        fileType: file.type || null,
        fileSizeBytes: Number.isFinite(file.size) ? file.size : null,
      }),
    );

    if (error instanceof AppError) {
      if (error.code === "VALIDATION") {
        throw error;
      }

      throw new AppError({
        code: error.code,
        publicMessage: UPLOAD_GENERIC_ERROR_MESSAGE,
        cause: error,
      });
    }

    throw new AppError({
      code: "UPSTREAM",
      publicMessage: UPLOAD_GENERIC_ERROR_MESSAGE,
      cause: error,
    });
  }
}
