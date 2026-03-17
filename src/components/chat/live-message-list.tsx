"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  backfillMessagesAfterCursorAction,
  hydrateRealtimeMessageAction,
} from "@/lib/actions/messages";
import { logError, logInfo } from "@/lib/logging/app-logger";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  compareRenderedMessages,
  mergeRenderedMessages,
  type RenderedMessage,
} from "@/lib/messages/rendered-message";

import { MessageList } from "./message-list";

type RealtimeMessageRow = {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_display_name?: string | null;
  text: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string | null;
};

const NOTIFICATION_PREVIEW_LIMIT = 120;
const NOTIFICATION_CLOSE_DELAY_MS = 5000;

function upsertRealtimeRenderedMessage(
  current: RenderedMessage[],
  incoming: RenderedMessage,
): RenderedMessage[] {
  const existingIndex = current.findIndex((message) => message.id === incoming.id);

  if (existingIndex === -1) {
    return mergeRenderedMessages(current, [incoming]);
  }

  const next = [...current];
  next[existingIndex] = incoming;
  return next;
}

function isRealtimeMessageRow(value: unknown): value is RealtimeMessageRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.sender_id === "string" &&
    typeof candidate.sender_email === "string" &&
    typeof candidate.created_at === "string" &&
    (typeof candidate.updated_at === "string" || candidate.updated_at === null) &&
    (typeof candidate.text === "string" || candidate.text === null) &&
    (typeof candidate.image_path === "string" || candidate.image_path === null)
  );
}

function getNotificationPreviewText(message: RenderedMessage): string {
  const trimmedText = message.text?.trim();

  if (trimmedText && message.image) {
    return `${trimmedText.slice(0, NOTIFICATION_PREVIEW_LIMIT)}${trimmedText.length > NOTIFICATION_PREVIEW_LIMIT ? "..." : ""} (с изображением)`;
  }

  if (trimmedText) {
    return `${trimmedText.slice(0, NOTIFICATION_PREVIEW_LIMIT)}${trimmedText.length > NOTIFICATION_PREVIEW_LIMIT ? "..." : ""}`;
  }

  if (message.image) {
    return "Изображение";
  }

  return "Новое сообщение";
}

function shouldShowBrowserNotification(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (window.Notification.permission !== "granted") {
    return false;
  }

  return document.visibilityState !== "visible" || !document.hasFocus();
}

function showBrowserNotification(message: RenderedMessage, currentUserId: string) {
  if (message.senderId === currentUserId || !shouldShowBrowserNotification()) {
    return;
  }

  try {
    const notification = new window.Notification(`Новое сообщение от ${message.senderName}`, {
      body: getNotificationPreviewText(message),
      tag: `chat-message-${message.id}`,
    });

    logInfo("chat.notification_shown", {
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      hasText: Boolean(message.text?.trim()),
      hasImage: Boolean(message.image),
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    window.setTimeout(() => {
      notification.close();
    }, NOTIFICATION_CLOSE_DELAY_MS);
  } catch (error) {
    logError("chat.notification_failed", error, {
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      hasText: Boolean(message.text?.trim()),
      hasImage: Boolean(message.image),
    });
  }
}

export function LiveMessageList({
  currentUserId,
  initialMessages,
  hasMore,
  loadedPages,
}: {
  currentUserId: string;
  initialMessages: RenderedMessage[];
  hasMore: boolean;
  loadedPages: number;
}) {
  const [realtimeMessages, setRealtimeMessages] = useState<RenderedMessage[]>([]);
  const [connectionLost, setConnectionLost] = useState(false);
  const messages = useMemo(
    () => mergeRenderedMessages(initialMessages, realtimeMessages),
    [initialMessages, realtimeMessages],
  );
  const latestMessage = useMemo(() => {
    if (messages.length === 0) {
      return null;
    }

    return [...messages].sort(compareRenderedMessages).at(-1) ?? null;
  }, [messages]);
  const latestMessageRef = useRef<RenderedMessage | null>(latestMessage);

  useEffect(() => {
    latestMessageRef.current = latestMessage;
  }, [latestMessage]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let wasDisconnected = false;

    async function runBackfill() {
      if (!latestMessageRef.current) {
        return;
      }

      const backfilledMessages = await backfillMessagesAfterCursorAction({
        createdAt: latestMessageRef.current.createdAt,
        id: latestMessageRef.current.id,
      });

      if (!active || backfilledMessages.length === 0) {
        return;
      }

      setRealtimeMessages((current) => mergeRenderedMessages(current, backfilledMessages));
    }

    const channel = supabase
      .channel("chat-messages-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (!isRealtimeMessageRow(payload.new)) {
            return;
          }

          void (async () => {
            const renderedMessage = await hydrateRealtimeMessageAction({
              id: payload.new.id,
              senderId: payload.new.sender_id,
              senderEmail: payload.new.sender_email,
              senderDisplayName: payload.new.sender_display_name ?? null,
              text: payload.new.text,
              imagePath: payload.new.image_path,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
            });

            if (!active || !renderedMessage) {
              return;
            }

            showBrowserNotification(renderedMessage, currentUserId);
            setRealtimeMessages((current) => upsertRealtimeRenderedMessage(current, renderedMessage));
          })();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (!isRealtimeMessageRow(payload.new)) {
            return;
          }

          void (async () => {
            const renderedMessage = await hydrateRealtimeMessageAction({
              id: payload.new.id,
              senderId: payload.new.sender_id,
              senderEmail: payload.new.sender_email,
              senderDisplayName: payload.new.sender_display_name ?? null,
              text: payload.new.text,
              imagePath: payload.new.image_path,
              createdAt: payload.new.created_at,
              updatedAt: payload.new.updated_at,
            });

            if (!active || !renderedMessage) {
              return;
            }

            setRealtimeMessages((current) => upsertRealtimeRenderedMessage(current, renderedMessage));
          })();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const oldRow = payload.old as { id?: unknown } | null;
          const deletedId = typeof oldRow?.id === "string" ? oldRow.id : null;

          if (!deletedId) {
            return;
          }

          logInfo("chat.realtime_delete_received", { messageId: deletedId });
        },
      )
      .subscribe((status) => {
        if (!active) {
          return;
        }

        if (status === "SUBSCRIBED") {
          setConnectionLost(false);

          if (wasDisconnected) {
            wasDisconnected = false;
            void runBackfill();
          }

          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          wasDisconnected = true;
          setConnectionLost(true);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <div className="mt-4 space-y-4">
      {connectionLost ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Соединение потеряно
        </p>
      ) : null}

      <MessageList hasMore={hasMore} loadedPages={loadedPages} messages={messages} />
    </div>
  );
}
