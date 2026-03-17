import type { RenderedMessage } from "@/lib/messages/rendered-message";

type MessageListProps = {
  currentUserId: string;
  messages: RenderedMessage[];
  hasMore: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatMessageDate(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

type MessageGroupMeta = {
  isOutgoing: boolean;
  isGroupStart: boolean;
  isGroupEnd: boolean;
  isGroupedWithPrev: boolean;
};

function buildGroupMeta(messages: RenderedMessage[], currentUserId: string): MessageGroupMeta[] {
  return messages.map((message, index) => {
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    const isOutgoing = message.senderId === currentUserId;

    const isGroupedWithPrev = (() => {
      if (!prev) {
        return false;
      }

      const sameSender = prev.senderId === message.senderId;
      const deltaMs = Math.abs(new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime());
      const withinWindow = Number.isFinite(deltaMs) && deltaMs <= GROUP_WINDOW_MS;
      return sameSender && withinWindow;
    })();

    const isGroupedWithNext = (() => {
      if (!next) {
        return false;
      }

      const sameSender = next.senderId === message.senderId;
      const deltaMs = Math.abs(new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime());
      const withinWindow = Number.isFinite(deltaMs) && deltaMs <= GROUP_WINDOW_MS;
      return sameSender && withinWindow;
    })();

    return {
      isOutgoing,
      isGroupStart: !isGroupedWithPrev,
      isGroupEnd: !isGroupedWithNext,
      isGroupedWithPrev,
    };
  });
}

export function MessageList({
  currentUserId,
  messages,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        В чате пока нет сообщений. Первое сообщение появится здесь.
      </div>
    );
  }

  const groupMeta = buildGroupMeta(messages, currentUserId);

  return (
    <div className="mt-4 space-y-4">
      {hasMore ? (
        <div className="flex justify-center">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            disabled={!onLoadOlder || Boolean(loadingOlder)}
            type="button"
            onClick={onLoadOlder}
          >
            {loadingOlder ? "Загрузка..." : "Показать более ранние сообщения"}
          </button>
        </div>
      ) : null}

      <div>
        {messages.map((message, index) => {
          const meta = groupMeta[index];
          const spacingClass = index === 0 ? "" : meta.isGroupedWithPrev ? "mt-1" : "mt-3";
          const alignmentClass = meta.isOutgoing ? "justify-end" : "justify-start";
          const bubbleColor = meta.isOutgoing ? "bg-[#2B5278]" : "bg-[#182533]";
          const shouldShowTail = meta.isGroupEnd;
          const tailClass = shouldShowTail
            ? meta.isOutgoing
              ? "before:absolute before:bottom-[6px] before:right-[-6px] before:h-3 before:w-3 before:rotate-45 before:rounded-sm before:bg-[#2B5278]"
              : "before:absolute before:bottom-[6px] before:left-[-6px] before:h-3 before:w-3 before:rotate-45 before:rounded-sm before:bg-[#182533]"
            : "";

          return (
            <div key={message.id} className={`${spacingClass} flex ${alignmentClass}`}>
              <article
                data-group-start={meta.isGroupStart ? "true" : "false"}
                data-group-end={meta.isGroupEnd ? "true" : "false"}
                data-outgoing={meta.isOutgoing ? "true" : "false"}
                className={`relative max-w-[78%] rounded-2xl ${bubbleColor} px-2.5 py-2 text-[#E6EEF7] sm:max-w-[62%] ${tailClass}`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <p className="break-all text-sm font-medium">{message.senderName}</p>
                  <time className="text-sm text-[#8FA1B3]" dateTime={message.createdAt}>
                    {formatMessageDate(message.createdAt)}
                  </time>
                </div>

                {message.text ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5">{message.text}</p>
                ) : null}

                {message.image ? (
                  <div className="mt-2 overflow-hidden rounded-xl">
                    <img
                      alt={message.image.alt}
                      className="block max-h-[28rem] w-full object-contain"
                      loading="lazy"
                      src={message.image.url}
                    />
                  </div>
                ) : null}
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
