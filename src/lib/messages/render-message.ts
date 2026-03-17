import "server-only";

import { getAvatarSignedUrl } from "@/lib/profile/profile-service";
import { getMessageImageSignedUrl } from "@/lib/messages/get-message-image-signed-url";
import type { RenderedMessage } from "@/lib/messages/rendered-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RenderMessageInput = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  text: string | null;
  imagePath: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

type ProfileAvatarRow = {
  id: string;
  avatar_path: string | null;
};

async function bestEffortGetSenderAvatarUrl(senderId: string): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,avatar_path")
      .eq("id", senderId)
      .maybeSingle();

    if (error) {
      return null;
    }

    const row = (data as ProfileAvatarRow | null) ?? null;
    return await getAvatarSignedUrl(row?.avatar_path ?? null);
  } catch {
    return null;
  }
}

async function getSenderAvatarUrlsForMessages(
  messages: RenderMessageInput[],
): Promise<Map<string, string | null>> {
  const uniqueIds = Array.from(
    new Set(messages.map((message) => message.senderId).filter((id) => id.trim().length > 0)),
  );

  if (uniqueIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,avatar_path")
      .in("id", uniqueIds);

    if (error) {
      return new Map();
    }

    const rows = (data ?? []) as ProfileAvatarRow[];
    const pathById = new Map<string, string | null>();
    for (const row of rows) {
      pathById.set(row.id, row.avatar_path);
    }

    const signedUrls = await Promise.all(
      uniqueIds.map(async (id) => ({
        id,
        url: await getAvatarSignedUrl(pathById.get(id) ?? null),
      })),
    );

    return new Map(signedUrls.map((entry) => [entry.id, entry.url]));
  } catch {
    return new Map();
  }
}

export async function renderMessageForChat(message: RenderMessageInput): Promise<RenderedMessage> {
  const imageUrl = message.imagePath ? await getMessageImageSignedUrl(message.imagePath) : null;
  const senderAvatarUrl =
    message.senderAvatarUrl !== undefined
      ? message.senderAvatarUrl
      : await bestEffortGetSenderAvatarUrl(message.senderId);

  return {
    id: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    senderAvatarUrl,
    text: message.text,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt ?? null,
    image: imageUrl
      ? {
          url: imageUrl,
          alt: message.text?.slice(0, 80) || `Изображение от ${message.senderName}`,
        }
      : null,
  };
}

export async function renderMessagesForChat(
  messages: RenderMessageInput[],
): Promise<RenderedMessage[]> {
  const avatarUrlBySenderId = await getSenderAvatarUrlsForMessages(messages);
  return Promise.all(
    messages.map((message) =>
      renderMessageForChat({
        ...message,
        senderAvatarUrl: avatarUrlBySenderId.get(message.senderId) ?? null,
      }),
    ),
  );
}
