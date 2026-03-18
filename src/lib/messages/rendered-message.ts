export type MessageDeliveryStatus = "pending" | "sent" | "failed";

/** Данные цитаты/ответа на сообщение (превью в bubble и в reply panel). */
export type MessageReplyTo = {
  /** id исходного сообщения; null после удаления original. */
  messageId: string | null;
  senderId: string;
  senderName: string;
  /** Текст превью (до 80 символов + «…» или «Фото»/«Сообщение»). */
  previewText: string;
  hasImage: boolean;
  /** true только если messageId не null и сообщение доступно для перехода. */
  isNavigable: boolean;
};

export type RenderedMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  text: string | null;
  createdAt: string;
  updatedAt: string | null;
  clientId?: string;
  deliveryStatus?: MessageDeliveryStatus;
  errorMessage?: string | null;
  isOptimistic?: boolean;
  image: {
    url: string;
    alt: string;
  } | null;
  /** Данные ответа на сообщение; null если сообщение не является ответом. */
  replyTo?: MessageReplyTo | null;
};

export function compareRenderedMessages(left: RenderedMessage, right: RenderedMessage): number {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

export function mergeRenderedMessages(
  current: RenderedMessage[],
  incoming: RenderedMessage[],
): RenderedMessage[] {
  const merged = new Map<string, RenderedMessage>();

  for (const message of current) {
    merged.set(message.id, message);
  }

  for (const message of incoming) {
    merged.set(message.id, message);
  }

  return Array.from(merged.values()).sort(compareRenderedMessages);
}
