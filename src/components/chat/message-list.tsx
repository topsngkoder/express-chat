import type { RenderedMessage } from "@/lib/messages/rendered-message";

type MessageListProps = {
  currentUserId: string;
  messages: RenderedMessage[];
  hasMore: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatMessageTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function getInitials(senderName: string): string {
  const trimmed = senderName.trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts.at(0)?.[0] ?? "?";
  const second = parts.length > 1 ? parts.at(1)?.[0] ?? "" : parts.at(0)?.[1] ?? "";
  const result = `${first}${second}`.toUpperCase();
  return result.length > 0 ? result : "?";
}

const SENDER_NAME_COLORS = [
  "#F07474",
  "#F4A261",
  "#E9C46A",
  "#2A9D8F",
  "#3A86FF",
  "#8338EC",
  "#FF006E",
  "#4CC9F0",
] as const;

function hashSenderIdToColor(senderId: string): string {
  let hash = 0;
  for (let i = 0; i < senderId.length; i += 1) {
    hash = (hash * 31 + senderId.charCodeAt(i)) | 0;
  }

  const index = Math.abs(hash) % SENDER_NAME_COLORS.length;
  return SENDER_NAME_COLORS[index] ?? SENDER_NAME_COLORS[0];
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
          const showAvatar = !meta.isOutgoing && meta.isGroupStart;
          const reserveAvatarSpace = !meta.isOutgoing;
          const shouldShowSenderName = !meta.isOutgoing && meta.isGroupStart;
          const senderNameColor = shouldShowSenderName ? hashSenderIdToColor(message.senderId) : null;
          const isImageOnly = Boolean(message.image) && !message.text;
          const bubblePaddingClass = isImageOnly ? "p-1" : "px-2.5 py-2";

          return (
            <div key={message.id} className={`${spacingClass} flex ${alignmentClass}`}>
              <div className={`flex items-end ${meta.isOutgoing ? "" : "gap-2"}`}>
                {reserveAvatarSpace ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {showAvatar ? (
                      message.senderAvatarUrl ? (
                        <img
                          alt={message.senderName}
                          className="h-8 w-8 rounded-full object-cover"
                          loading="lazy"
                          src={message.senderAvatarUrl}
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22303D] text-xs font-semibold text-[#E6EEF7]">
                          {getInitials(message.senderName)}
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                <div className="flex min-w-0 flex-col">
                  {shouldShowSenderName ? (
                    <p
                      className="mb-1 truncate text-xs font-semibold leading-4"
                      style={{ color: senderNameColor ?? undefined }}
                    >
                      {message.senderName}
                    </p>
                  ) : null}

                  <article
                    data-group-start={meta.isGroupStart ? "true" : "false"}
                    data-group-end={meta.isGroupEnd ? "true" : "false"}
                    data-outgoing={meta.isOutgoing ? "true" : "false"}
                    className={`relative max-w-[78%] rounded-2xl ${bubbleColor} ${bubblePaddingClass} text-[#E6EEF7] sm:max-w-[62%] ${tailClass}`}
                  >
                    {message.text ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.text}</p>
                    ) : null}

                    {message.image ? (
                      <div className={message.text ? "mt-2 overflow-hidden rounded-xl" : "overflow-hidden rounded-xl"}>
                        <img
                          alt={message.image.alt}
                          className="block max-h-[320px] w-full rounded-xl object-contain sm:max-h-[420px]"
                          loading="lazy"
                          src={message.image.url}
                        />
                      </div>
                    ) : null}

                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[11px] leading-4 ${
                        meta.isOutgoing ? "text-[#B7C9DA]" : "text-[#8FA1B3]"
                      }`}
                    >
                      <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                      {meta.isOutgoing && message.updatedAt ? <span className="ml-1">изменено</span> : null}
                      {meta.isOutgoing ? (
                        <span aria-hidden="true" className="select-none">
                          ✓✓
                        </span>
                      ) : null}
                    </div>
                  </article>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
