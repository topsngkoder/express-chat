import type { Metadata } from "next";

import { LogoutButton } from "@/components/auth/logout-button";
import { ChatFeedbackSections } from "@/components/chat/chat-feedback-sections";
import { LiveMessageList } from "@/components/chat/live-message-list";
import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
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
    <main className="min-h-screen bg-zinc-50 px-3 py-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-2xl font-semibold sm:text-3xl">Экспресс-чат</h1>
            <LogoutButton className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800" />
          </div>
        </header>

        <section className="min-h-[320px] rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="flex h-full flex-col">
            <LiveMessageList
              currentUserId={user.id}
              hasMore={nextCursor !== null}
              initialMessages={messages}
              loadedPages={historyPages}
            />
          </div>
        </section>

        <ChatFeedbackSections />
      </div>
    </main>
  );
}
