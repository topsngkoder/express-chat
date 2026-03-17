import { imageSize } from "image-size";
import { AppError } from "@/lib/errors";

/** Сообщения об ошибках по спецификации (раздел 14) */
export const IMAGE_ERROR_MESSAGES = {
  unsupportedFormat: "Формат изображения не поддерживается",
  tooLarge: "Размер изображения превышает 5 МБ",
  invalidResolution: "Изображение имеет недопустимое разрешение",
} as const;

/** Допустимые MIME-типы: JPEG, PNG, WebP. GIF запрещён. */
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Максимальный размер файла: 5 МБ */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Минимальная сторона изображения в пикселях */
export const MIN_IMAGE_DIMENSION = 64;

/** Максимальная сторона изображения в пикселях */
export const MAX_IMAGE_DIMENSION = 4000;

/** Результат успешной валидации изображения (без path — он задаётся при загрузке). */
export type ValidatedImageMeta = {
  mimeType: AllowedImageMimeType;
  sizeBytes: number;
  width: number;
  height: number;
  /** Рекомендуемое расширение для пути в Storage (без точки). */
  suggestedExt: string;
};

const MIME_TO_EXT: Record<AllowedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Серверная валидация файла изображения.
 * Проверяет MIME, размер, разрешение. Не изменяет файл.
 * @throws AppError с code VALIDATION и publicMessage из спецификации
 */
export function validateImageFile(
  buffer: Buffer,
  mimeType: string | undefined
): ValidatedImageMeta {
  const normalizedMime = mimeType?.toLowerCase().trim();

  if (
    !normalizedMime ||
    !ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as AllowedImageMimeType)
  ) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: IMAGE_ERROR_MESSAGES.unsupportedFormat,
    });
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: IMAGE_ERROR_MESSAGES.tooLarge,
    });
  }

  let dimensions: { width?: number; height?: number; type?: string };
  try {
    dimensions = imageSize(new Uint8Array(buffer)) ?? {};
  } catch {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: IMAGE_ERROR_MESSAGES.unsupportedFormat,
    });
  }

  const width = dimensions.width;
  const height = dimensions.height;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: IMAGE_ERROR_MESSAGES.invalidResolution,
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

/**
 * Опциональный клиентский precheck для UX (размер и MIME до отправки на сервер).
 * Не проверяет разрешение (требуется загрузка и парсинг). Возвращает null при валидности,
 * иначе сообщение для показа пользователю.
 */
export function clientImagePrecheck(
  file: File
): { valid: true } | { valid: false; message: string } {
  const mime = (file.type ?? "").toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime as AllowedImageMimeType)) {
    return { valid: false, message: IMAGE_ERROR_MESSAGES.unsupportedFormat };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, message: IMAGE_ERROR_MESSAGES.tooLarge };
  }
  return { valid: true };
}
