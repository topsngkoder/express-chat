import "server-only";

import { getMessageImageSignedUrl } from "@/lib/messages/get-message-image-signed-url";
import type { RenderedMessage } from "@/lib/messages/rendered-message";

type RenderMessageInput = {
  id: string;
  senderId: string;
  senderEmail: string;
  text: string | null;
  imagePath: string | null;
  createdAt: string;
};

export async function renderMessageForChat(message: RenderMessageInput): Promise<RenderedMessage> {
  const imageUrl = message.imagePath ? await getMessageImageSignedUrl(message.imagePath) : null;

  return {
    id: message.id,
    senderId: message.senderId,
    senderEmail: message.senderEmail,
    text: message.text,
    createdAt: message.createdAt,
    image: imageUrl
      ? {
          url: imageUrl,
          alt: message.text?.slice(0, 80) || `Изображение от ${message.senderEmail}`,
        }
      : null,
  };
}

export async function renderMessagesForChat(
  messages: RenderMessageInput[],
): Promise<RenderedMessage[]> {
  return Promise.all(messages.map((message) => renderMessageForChat(message)));
}
