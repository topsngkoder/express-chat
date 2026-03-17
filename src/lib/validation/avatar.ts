import { imageSize } from "image-size";

import { AppError } from "@/lib/errors";
import { ALLOWED_IMAGE_MIME_TYPES, type AllowedImageMimeType } from "@/lib/validation/image";

export const AVATAR_ERROR_MESSAGES = {
  unsupportedFormat: "Формат аватара не поддерживается",
  tooLarge: "Размер аватара превышает 1 МБ",
  invalidResolution: "Разрешение аватара должно быть от 64×64 до 512×512",
} as const;

/** Максимальный размер файла: 1 МБ */
export const MAX_AVATAR_SIZE_BYTES = 1 * 1024 * 1024;

/** Минимальная сторона аватара в пикселях */
export const MIN_AVATAR_DIMENSION = 64;

/** Максимальная сторона аватара в пикселях */
export const MAX_AVATAR_DIMENSION = 512;

export type ValidatedAvatarMeta = {
  mimeType: AllowedImageMimeType;
  sizeBytes: number;
  width: number;
  height: number;
  suggestedExt: string;
};

const MIME_TO_EXT: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Серверная валидация файла аватара.
 * Проверяет MIME, размер, разрешение. Не изменяет файл.
 * @throws AppError с code VALIDATION и publicMessage без технических деталей
 */
export function validateAvatarFile(
  buffer: Buffer,
  mimeType: string | undefined
): ValidatedAvatarMeta {
  const normalizedMime = mimeType?.toLowerCase().trim();

  if (
    !normalizedMime ||
    !ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as AllowedImageMimeType)
  ) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.unsupportedFormat,
    });
  }

  if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.tooLarge,
    });
  }

  let dimensions: { width?: number; height?: number; type?: string };
  try {
    dimensions = imageSize(new Uint8Array(buffer)) ?? {};
  } catch {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.unsupportedFormat,
    });
  }

  const width = dimensions.width;
  const height = dimensions.height;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width < MIN_AVATAR_DIMENSION ||
    height < MIN_AVATAR_DIMENSION ||
    width > MAX_AVATAR_DIMENSION ||
    height > MAX_AVATAR_DIMENSION
  ) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.invalidResolution,
    });
  }

  const suggestedExt =
    MIME_TO_EXT[normalizedMime as AllowedImageMimeType] ?? MIME_TO_EXT["image/jpeg"];

  return {
    mimeType: normalizedMime as AllowedImageMimeType,
    sizeBytes: buffer.length,
    width,
    height,
    suggestedExt,
  };
}

