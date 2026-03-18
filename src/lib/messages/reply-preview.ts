/**
 * Единые правила превью для ответов на сообщения (reply panel, bubble, snapshot).
 * Спека: первая строка без переносов, до 80 символов + «…»; нет текста + есть изображение → «Фото»; иначе «Сообщение».
 */

export const PREVIEW_MAX_LENGTH = 80;

/** Усекает текст до maxLength символов, добавляет «…» если обрезан. */
export function truncatePreview(text: string, maxLength: number = PREVIEW_MAX_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + "…";
}

/**
 * Первая строка текста без переносов, усечённая до 80 символов.
 * Используется для превью, когда у сообщения есть текст.
 */
export function normalizeFirstLine(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return truncatePreview(firstLine.trim());
}

/** Текст «Фото», когда у сообщения только изображение без текста. */
export const PREVIEW_LABEL_PHOTO = "Фото";

/** Текст «Сообщение», когда нет ни текста, ни изображения. */
export const PREVIEW_LABEL_MESSAGE = "Сообщение";

/**
 * Строит строку превью по правилам спеки:
 * - есть текст → первая строка без переносов, до 80 символов + «…»;
 * - нет текста, есть изображение → «Фото»;
 * - иначе → «Сообщение».
 */
export function buildPreviewText(text: string | null, hasImage: boolean): string {
  const hasText = text != null && text.trim().length > 0;
  if (hasText) return normalizeFirstLine(text);
  if (hasImage) return PREVIEW_LABEL_PHOTO;
  return PREVIEW_LABEL_MESSAGE;
}
