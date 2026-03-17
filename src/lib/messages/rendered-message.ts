export type MessageDeliveryStatus = "pending" | "sent" | "failed";

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
