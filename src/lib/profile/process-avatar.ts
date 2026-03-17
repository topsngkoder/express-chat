import sharp from "sharp";

import { AppError } from "@/lib/errors";
import { AVATAR_ERROR_MESSAGES } from "@/lib/validation/avatar";

const MAX_AVATAR_SIZE_BYTES = 1 * 1024 * 1024;
const MIN_AVATAR_DIMENSION = 64;
const MAX_AVATAR_DIMENSION = 512;

export type ProcessedAvatar = {
  buffer: Buffer;
  mimeType: "image/webp";
  suggestedExt: "webp";
};

/**
 * Принимает любое изображение (форматы, поддерживаемые sharp), приводит к разрешению
 * 64–512 px и сжимает до ≤ 1 МБ. Возвращает буфер в формате WebP.
 * @throws AppError при нечитаемом файле или когда изображение после ресайза не укладывается в 64–512
 */
export async function processAvatarToMax1MB(
  inputBuffer: Buffer,
  _inputMimeType?: string,
): Promise<ProcessedAvatar> {
  let image: sharp.Sharp;
  try {
    image = sharp(inputBuffer);
  } catch {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.unsupportedFormat,
    });
  }

  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.unsupportedFormat,
    });
  }

  // Вписываем в 512×512
  const resized = await image
    .resize(MAX_AVATAR_DIMENSION, MAX_AVATAR_DIMENSION, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const w = resized.info.width ?? 0;
  const h = resized.info.height ?? 0;

  if (w < MIN_AVATAR_DIMENSION || h < MIN_AVATAR_DIMENSION) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: AVATAR_ERROR_MESSAGES.invalidResolution,
    });
  }

  // Бинарный поиск по quality: максимальное качество при размере ≤ 1 МБ
  let minQ = 1;
  let maxQ = 90;
  let bestBuffer: Buffer | null = null;

  while (minQ <= maxQ) {
    const q = Math.ceil((minQ + maxQ) / 2);
    const buf = await sharp(resized.data)
      .webp({ quality: q })
      .toBuffer();

    if (buf.length <= MAX_AVATAR_SIZE_BYTES) {
      bestBuffer = buf;
      minQ = q + 1;
    } else {
      maxQ = q - 1;
    }
  }

  if (bestBuffer) {
    return {
      buffer: bestBuffer,
      mimeType: "image/webp",
      suggestedExt: "webp",
    };
  }

  // Не уложились в 1 МБ при 512px — уменьшаем сторону и сжимаем
  const sizes = [384, 256, 128, 64];
  for (const side of sizes) {
    if (side < MIN_AVATAR_DIMENSION) break;
    const buf = await sharp(inputBuffer)
      .resize(side, side, { fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
    if (buf.length <= MAX_AVATAR_SIZE_BYTES) {
      return { buffer: buf, mimeType: "image/webp", suggestedExt: "webp" };
    }
  }

  throw new AppError({
    code: "VALIDATION",
    publicMessage: AVATAR_ERROR_MESSAGES.tooLarge,
  });
}
