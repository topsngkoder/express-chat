import Link from "next/link";

import type { RenderedMessage } from "@/lib/messages/rendered-message";

type MessageListProps = {
  messages: RenderedMessage[];
  loadedPages: number;
  hasMore: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMessageDate(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function MessageList({ messages, loadedPages, hasMore }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        В чате пока нет сообщений. Первое сообщение появится здесь.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {hasMore ? (
        <div className="flex justify-center">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            href={`/chat?historyPages=${loadedPages + 1}`}
          >
            Показать более ранние сообщения
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        {messages.map((message) => (
          <article
            key={message.id}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <p className="break-all text-sm font-medium text-zinc-950 dark:text-zinc-50">
                {message.senderName}
              </p>
              <time
                className="text-sm text-zinc-600 dark:text-zinc-400"
                dateTime={message.createdAt}
              >
                {formatMessageDate(message.createdAt)}
              </time>
            </div>

            {message.text ? (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                {message.text}
              </p>
            ) : null}

            {message.image ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <img
                  alt={message.image.alt}
                  className="block max-h-[28rem] w-full object-contain"
                  loading="lazy"
                  src={message.image.url}
                />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
