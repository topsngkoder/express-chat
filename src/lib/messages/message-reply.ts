/**
 * Сборка reply snapshot: из исходного сообщения (RenderedMessage) или из полей строки БД.
 * Одна точка формирования MessageReplyTo для reply panel, optimistic UI и серверного рендера.
 */

import type { MessageReplyTo, RenderedMessage } from "@/lib/messages/rendered-message";
import { buildPreviewText } from "@/lib/messages/reply-preview";

/** Поля reply из строки/формы (camelCase). */
export type ReplyRowFields = {
  replyToMessageId?: string | null;
  replyToSenderId?: string | null;
  replyToSenderName?: string | null;
  replyToPreviewText?: string | null;
  replyToHasImage?: boolean | null;
};

/**
 * Собирает MessageReplyTo из исходного сообщения (для reply draft и optimistic insert).
 * previewText строится по правилам спеки; isNavigable = true (исходное сообщение есть в ленте).
 */
export function buildReplySnapshotFromMessage(message: RenderedMessage): MessageReplyTo {
  const hasImage = message.image != null;
  const previewText = buildPreviewText(message.text, hasImage);

  return {
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    previewText,
    hasImage,
    isNavigable: true,
  };
}

/**
 * Собирает MessageReplyTo из полей строки/ответа БД (для SSR, pagination, realtime hydrate).
 * isNavigable = (replyToMessageId != null).
 */
export function buildReplyToFromRow(row: ReplyRowFields): MessageReplyTo | null {
  const hasReply =
    row.replyToSenderId != null ||
    row.replyToSenderName != null ||
    row.replyToPreviewText != null ||
    row.replyToHasImage === true;
  if (!hasReply) return null;

  return {
    messageId: row.replyToMessageId ?? null,
    senderId: row.replyToSenderId ?? "",
    senderName: row.replyToSenderName ?? "",
    previewText: row.replyToPreviewText ?? "",
    hasImage: row.replyToHasImage ?? false,
    isNavigable: row.replyToMessageId != null && row.replyToMessageId.length > 0,
  };
}
