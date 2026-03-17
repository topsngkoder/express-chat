import "server-only";

import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapSupabaseError } from "@/lib/supabase/map-error";

export const MESSAGE_PAGE_SIZE = 50;

type MessageRow = {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_display_name: string | null;
  text: string | null;
  image_path: string | null;
  image_mime_type: string | null;
  image_size_bytes: number | null;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
  updated_at: string | null;
};

export type MessageListItem = {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  text: string | null;
  imagePath: string | null;
  imageMimeType: string | null;
  imageSizeBytes: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  createdAt: string;
  updatedAt: string | null;
};

export type MessageListCursor = {
  createdAt: string;
  id: string;
};

export type MessagesPage = {
  items: MessageListItem[];
  nextCursor: MessageListCursor | null;
};

function mapMessageRow(row: MessageRow): MessageListItem {
  const senderName =
    (row.sender_display_name?.trim() && row.sender_display_name.trim().length > 0)
      ? row.sender_display_name.trim()
      : row.sender_email;

  return {
    id: row.id,
    senderId: row.sender_id,
    senderEmail: row.sender_email,
    senderName,
    text: row.text,
    imagePath: row.image_path,
    imageMimeType: row.image_mime_type,
    imageSizeBytes: row.image_size_bytes,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildOlderThanFilter(cursor: MessageListCursor): string {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

function buildNewerThanFilter(cursor: MessageListCursor): string {
  return `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`;
}

export async function listMessagesPage(cursor?: MessageListCursor | null): Promise<MessagesPage> {
  await requireConfirmedUser();

  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("messages")
      .select(
        "id,sender_id,sender_email,sender_display_name,text,image_path,image_mime_type,image_size_bytes,image_width,image_height,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1);

    if (cursor) {
      query = query.or(buildOlderThanFilter(cursor));
    }

    const { data, error } = await query;

    if (error) {
      throw mapSupabaseError(error);
    }

    const rows = (data ?? []) as MessageRow[];
    const hasMore = rows.length > MESSAGE_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows;
    const orderedRows = [...pageRows].reverse();
    const items = orderedRows.map(mapMessageRow);
    const oldestItem = items[0] ?? null;

    return {
      items,
      nextCursor: hasMore && oldestItem ? { createdAt: oldestItem.createdAt, id: oldestItem.id } : null,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw mapSupabaseError(error);
  }
}

export async function listMessagesAfterCursor(
  cursor: MessageListCursor,
): Promise<MessageListItem[]> {
  await requireConfirmedUser();

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("messages")
      .select(
        "id,sender_id,sender_email,sender_display_name,text,image_path,image_mime_type,image_size_bytes,image_width,image_height,created_at,updated_at",
      )
      .or(buildNewerThanFilter(cursor))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      throw mapSupabaseError(error);
    }

    const rows = (data ?? []) as MessageRow[];
    return rows.map(mapMessageRow);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw mapSupabaseError(error);
  }
}
