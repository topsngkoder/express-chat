import type { Metadata } from "next";

import { ChatShell } from "@/components/chat/chat-shell";
import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { getOrCreateCurrentProfile } from "@/lib/profile/profile-service";
import { renderMessagesForChat } from "@/lib/messages/render-message";
import { listMessagesPage, type MessageListItem } from "@/lib/messages/list-messages";

type ChatPageProps = {
  searchParams?: Promise<{
    historyPages?: string;
  }>;
};

const DEFAULT_HISTORY_PAGES = 1;
const MAX_HISTORY_PAGES = 20;

function parseHistoryPages(value: string | undefined): number {
  if (!value) {
    return DEFAULT_HISTORY_PAGES;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_HISTORY_PAGES;
  }

  return Math.min(parsed, MAX_HISTORY_PAGES);
}

export const metadata: Metadata = {
  title: "Экспресс-чат",
  description: "Защищенная страница чата",
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const historyPages = parseHistoryPages(params?.historyPages);
  const user = await requireConfirmedUser();
  const profile = await getOrCreateCurrentProfile();
  const displayName =
    (profile.displayName?.trim() && profile.displayName.trim().length > 0)
      ? profile.displayName.trim()
      : null;
  const userDisplayName = displayName ?? user.email;
  let nextCursor: Awaited<ReturnType<typeof listMessagesPage>>["nextCursor"] = null;
  const loadedItems: MessageListItem[] = [];

  for (let pageIndex = 0; pageIndex < historyPages; pageIndex += 1) {
    const page = await listMessagesPage(nextCursor);

    loadedItems.unshift(...page.items);
    nextCursor = page.nextCursor;

    if (!page.nextCursor) {
      break;
    }
  }

  const messages = await renderMessagesForChat(
    loadedItems.map((item) => ({
      id: item.id,
      senderId: item.senderId,
      senderName: item.senderName,
      text: item.text,
      imagePath: item.imagePath,
      createdAt: item.createdAt,
    })),
  );

  return (
    <ChatShell
      currentUserId={user.id}
      initialCursor={nextCursor}
      initialHasMore={nextCursor !== null}
      initialLoadedPages={historyPages}
      initialMessages={messages}
      userDisplayName={userDisplayName}
    />
  );
}
