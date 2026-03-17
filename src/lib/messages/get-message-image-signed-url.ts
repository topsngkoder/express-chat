import "server-only";

import { cache } from "react";

import { AppError } from "@/lib/errors";
import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError } from "@/lib/supabase/map-error";

const CHAT_IMAGES_BUCKET = "chat-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_ERROR_MESSAGE = "Не удалось выполнить операцию. Попробуйте позже";
const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const CHAT_IMAGE_PATH_PATTERN = new RegExp(
  `^${UUID_PATTERN}/\\d{4}/(0[1-9]|1[0-2])/${UUID_PATTERN}\\.(jpg|png|webp)$`,
  "i",
);

function normalizeChatImagePath(imagePath: string): string {
  const normalizedPath = imagePath.trim();

  if (!CHAT_IMAGE_PATH_PATTERN.test(normalizedPath)) {
    throw new AppError({
      code: "UPSTREAM",
      publicMessage: SIGNED_URL_ERROR_MESSAGE,
    });
  }

  return normalizedPath;
}

export const getMessageImageSignedUrl = cache(
  async (imagePath: string | null): Promise<string | null> => {
    await requireConfirmedUser();

    if (!imagePath) {
      return null;
    }

    const normalizedPath = normalizeChatImagePath(imagePath);

    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .storage
        .from(CHAT_IMAGES_BUCKET)
        .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS);

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data?.signedUrl) {
        throw new AppError({
          code: "UPSTREAM",
          publicMessage: SIGNED_URL_ERROR_MESSAGE,
        });
      }

      return data.signedUrl;
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError({
          code: error.code,
          publicMessage: SIGNED_URL_ERROR_MESSAGE,
          cause: error,
        });
      }

      throw new AppError({
        code: "UPSTREAM",
        publicMessage: SIGNED_URL_ERROR_MESSAGE,
        cause: error,
      });
    }
  },
);
