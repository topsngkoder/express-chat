"use server";

import { revalidatePath } from "next/cache";

import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { AppError } from "@/lib/errors";
import { listMessagesAfterCursor } from "@/lib/messages/list-messages";
import { createMessage } from "@/lib/messages/create-message";
import { renderMessageForChat, renderMessagesForChat } from "@/lib/messages/render-message";
import type { RenderedMessage } from "@/lib/messages/rendered-message";

export type MessageComposerState = {
  success: boolean;
  error: string | null;
};

type HydrateRealtimeMessageInput = {
  id: string;
  senderId: string;
  senderEmail: string;
  text: string | null;
  imagePath: string | null;
  createdAt: string;
};

type MessageCursorInput = {
  createdAt: string;
  id: string;
};

function getOptionalImageFile(formData: FormData): File | null {
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return null;
  }

  if (image.size === 0) {
    return null;
  }

  return image;
}

export async function createMessageFormAction(
  _previousState: MessageComposerState,
  formData: FormData,
): Promise<MessageComposerState> {
  const text = (formData.get("text") ?? "") as string;
  const imageFile = getOptionalImageFile(formData);

  try {
    await createMessage({
      text,
      imageFile,
    });

    revalidatePath("/chat");

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNEXPECTED",
            publicMessage: "Не удалось отправить сообщение. Попробуйте позже",
            cause: error,
          });

    return {
      success: false,
      error: appError.publicMessage,
    };
  }
}

function isHydrateRealtimeMessageInput(value: unknown): value is HydrateRealtimeMessageInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.senderId === "string" &&
    typeof candidate.senderEmail === "string" &&
    typeof candidate.createdAt === "string" &&
    (typeof candidate.text === "string" || candidate.text === null) &&
    (typeof candidate.imagePath === "string" || candidate.imagePath === null)
  );
}

function isMessageCursorInput(value: unknown): value is MessageCursorInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.createdAt === "string" && typeof candidate.id === "string";
}

export async function hydrateRealtimeMessageAction(
  input: HydrateRealtimeMessageInput,
): Promise<RenderedMessage | null> {
  try {
    await requireConfirmedUser();

    if (!isHydrateRealtimeMessageInput(input)) {
      return null;
    }

    return await renderMessageForChat(input);
  } catch {
    return null;
  }
}

export async function backfillMessagesAfterCursorAction(
  cursor: MessageCursorInput,
): Promise<RenderedMessage[]> {
  try {
    await requireConfirmedUser();

    if (!isMessageCursorInput(cursor)) {
      return [];
    }

    const messages = await listMessagesAfterCursor(cursor);

    return await renderMessagesForChat(
      messages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        senderEmail: message.senderEmail,
        text: message.text,
        imagePath: message.imagePath,
        createdAt: message.createdAt,
      })),
    );
  } catch {
    return [];
  }
}
