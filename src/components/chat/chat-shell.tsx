"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { MessageListCursor } from "@/lib/messages/list-messages";
import type { RenderedMessage } from "@/lib/messages/rendered-message";

import { LiveMessageList } from "./live-message-list";
import { MessageComposer } from "./message-composer";

type ChatModalState =
  | {
      type: "delete-confirm";
      messageId: string;
    }
  | null;

type ChatEditDraft =
  | {
      messageId: string;
      initialText: string | null;
    }
  | null;

export function ChatShell({
  currentUserId,
  userDisplayName,
  initialMessages,
  initialCursor,
  initialHasMore,
  initialLoadedPages,
}: {
  currentUserId: string;
  userDisplayName: string;
  initialMessages: RenderedMessage[];
  initialCursor: MessageListCursor | null;
  initialHasMore: boolean;
  initialLoadedPages: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const latestInsertRef = useRef<string | null>(null);

  const [cursor] = useState<MessageListCursor | null>(initialCursor);
  const [hasMore] = useState(initialHasMore);
  const [loadingMore] = useState(false);

  const [unseenCount] = useState(0);
  const [isAtBottom] = useState(true);

  const [editDraft] = useState<ChatEditDraft>(null);
  const [modalState] = useState<ChatModalState>(null);

  void cursor;
  void loadingMore;
  void unseenCount;
  void isAtBottom;
  void editDraft;
  void modalState;
  void composerRef;
  void latestInsertRef;

  return (
    <main className="dark h-dvh overflow-hidden bg-[#0E1621] text-[#E6EEF7]">
      <div className="mx-auto flex h-full w-full max-w-[960px] flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#22303D] bg-[#17212B] px-3 sm:px-4">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-5">Экспресс-чат</h1>
            <p className="truncate text-xs text-[#8FA1B3]">{userDisplayName}</p>
          </div>

          <Link
            aria-label="Настройки"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#607382] transition hover:bg-white/5 hover:text-[#E6EEF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            href="/settings"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="20"
              viewBox="0 0 24 24"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M19.4 15a8.2 8.2 0 0 0 .1-1 8.2 8.2 0 0 0-.1-1l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.8 7.8 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4H10a.5.5 0 0 0-.5.4l-.4 2.5a7.8 7.8 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 10a.5.5 0 0 0 .1.6l2 1.6a8.2 8.2 0 0 0-.1 1 8.2 8.2 0 0 0 .1 1l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1a7.8 7.8 0 0 0 1.7 1l.4 2.5c0 .2.2.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.5a7.8 7.8 0 0 0 1.7-1l2.4 1c.2.1.5 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6l-2-1.6Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </Link>
        </header>

        <section
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
        >
          <LiveMessageList
            currentUserId={currentUserId}
            hasMore={hasMore}
            initialMessages={initialMessages}
            loadedPages={initialLoadedPages}
          />
        </section>

        <footer
          ref={composerRef}
          className="shrink-0 border-t border-[#22303D] bg-[#17212B] px-3 py-2 sm:px-4"
        >
          <div className="max-h-[160px] overflow-y-auto">
            <MessageComposer />
          </div>
        </footer>
      </div>
    </main>
  );
}

