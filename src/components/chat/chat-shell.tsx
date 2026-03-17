"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createMessageFormAction, deleteMessageAction, editMessageAction } from "@/lib/actions/messages";
import type { MessageListCursor } from "@/lib/messages/list-messages";
import { mergeRenderedMessages, type RenderedMessage } from "@/lib/messages/rendered-message";

import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { LiveMessageList } from "./live-message-list";
import { MessageComposer, type MessageComposerSubmitInput } from "./message-composer";

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
      editingMessageHasImage: boolean;
    }
  | null;

const initialMessageComposerState = {
  success: false,
  error: null,
} as const;

function buildClientMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ChatShell({
  currentUserId,
  currentUserAvatarUrl,
  userDisplayName,
  initialMessages,
  initialCursor,
  initialHasMore,
  initialLoadedPages,
}: {
  currentUserId: string;
  currentUserAvatarUrl: string | null;
  userDisplayName: string;
  initialMessages: RenderedMessage[];
  initialCursor: MessageListCursor | null;
  initialHasMore: boolean;
  initialLoadedPages: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const latestInsertRef = useRef<string | null>(null);
  const didInitialScrollRef = useRef(false);
  const isAtBottomRef = useRef(true);

  const [unseenCount, setUnseenCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const [editDraft, setEditDraft] = useState<ChatEditDraft>(null);
  const [modalState, setModalState] = useState<ChatModalState>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<RenderedMessage[]>([]);

  const sendQueueRef = useRef(Promise.resolve());
  const objectUrlByClientIdRef = useRef(new Map<string, string>());

  void unseenCount;
  void isAtBottom;
  void composerRef;
  void latestInsertRef;
  void initialLoadedPages;
  void initialCursor;

  useLayoutEffect(() => {
    const scrollNode = scrollRef.current;
    const composerNode = composerRef.current;

    if (!scrollNode || !composerNode) {
      return;
    }

    const applyPadding = () => {
      const scrollRect = scrollNode.getBoundingClientRect();
      const composerRect = composerNode.getBoundingClientRect();

      // Если композер перекрывает scroll-область (overlay), добавляем ровно высоту перекрытия.
      const overlap = Math.max(0, scrollRect.bottom - composerRect.top);
      scrollNode.style.paddingBottom = overlap > 0 ? `${overlap}px` : "";
    };

    applyPadding();

    const resizeObserver = new ResizeObserver(() => {
      applyPadding();
    });

    resizeObserver.observe(composerNode);
    resizeObserver.observe(scrollNode);

    window.addEventListener("resize", applyPadding);

    return () => {
      window.removeEventListener("resize", applyPadding);
      resizeObserver.disconnect();
      scrollNode.style.paddingBottom = "";
    };
  }, []);

  useEffect(() => {
    const objectUrlByClientId = objectUrlByClientIdRef.current;

    return () => {
      for (const objectUrl of objectUrlByClientId.values()) {
        URL.revokeObjectURL(objectUrl);
      }

      objectUrlByClientId.clear();
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, []);

  const computeIsAtBottom = useCallback((): boolean => {
    const node = scrollRef.current;
    if (!node) {
      return true;
    }

    const distanceToBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
    return distanceToBottom <= 120;
  }, []);

  const handleScroll = useCallback(() => {
    const nextIsAtBottom = computeIsAtBottom();
    isAtBottomRef.current = nextIsAtBottom;
    setIsAtBottom(nextIsAtBottom);

    if (nextIsAtBottom) {
      setUnseenCount(0);
    }
  }, [computeIsAtBottom]);

  useEffect(() => {
    if (didInitialScrollRef.current) {
      return;
    }

    didInitialScrollRef.current = true;

    const node = scrollRef.current;
    if (!node) {
      return;
    }

    // Ждём layout, чтобы высоты были финальными для первого кадра.
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
  }, [scrollToBottom]);

  useEffect(() => {
    // Инициализация состояния “у низа” после первого layout.
    requestAnimationFrame(handleScroll);
  }, [handleScroll]);

  const handleRealtimeInsert = useCallback(
    (message: RenderedMessage) => {
      if (message.senderId === currentUserId) {
        return;
      }

      latestInsertRef.current = message.id;

      if (isAtBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
        return;
      }

      setUnseenCount((current) => current + 1);
    },
    [currentUserId, scrollToBottom],
  );

  const handleRequestDelete = useCallback((messageId: string) => {
    setDeleteError(null);
    setModalState({ type: "delete-confirm", messageId });
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    if (!deleteLoading) {
      setModalState(null);
      setDeleteError(null);
    }
  }, [deleteLoading]);

  const handleConfirmDelete = useCallback(async (messageId: string) => {
    setDeleteLoading(true);
    setDeleteError(null);

    const result = await deleteMessageAction(messageId);

    setDeleteLoading(false);
    if (result.success) {
      setModalState(null);
      setDeleteError(null);
    } else {
      setDeleteError(result.error ?? "Не удалось удалить сообщение. Попробуйте позже");
    }
  }, []);

  const handleRequestEdit = useCallback(
    (messageId: string, initialText: string | null, hasImage: boolean) => {
      setEditDraft({ messageId, initialText, editingMessageHasImage: hasImage });
    },
    [],
  );

  const handleSaveEdit = useCallback(async (text: string) => {
    if (!editDraft) return;
    const result = await editMessageAction(editDraft.messageId, text);
    if (!result.success) {
      throw new Error(result.error ?? "Не удалось сохранить изменения. Попробуйте позже");
    }
  }, [editDraft]);

  const handleCancelEdit = useCallback(() => {
    setEditDraft(null);
  }, []);

  const handleSubmitMessage = useCallback(
    ({ text, imageFile }: MessageComposerSubmitInput) => {
      const clientId = buildClientMessageId();
      const localId = `local:${clientId}`;
      const createdAt = new Date().toISOString();
      const objectUrl = imageFile ? URL.createObjectURL(imageFile) : null;

      if (objectUrl) {
        objectUrlByClientIdRef.current.set(clientId, objectUrl);
      }

      const optimisticMessage: RenderedMessage = {
        id: localId,
        clientId,
        senderId: currentUserId,
        senderName: userDisplayName,
        senderAvatarUrl: currentUserAvatarUrl,
        text,
        createdAt,
        updatedAt: null,
        deliveryStatus: "pending",
        errorMessage: null,
        isOptimistic: true,
        image: objectUrl
          ? {
              url: objectUrl,
              alt: text?.slice(0, 80) || `Изображение от ${userDisplayName}`,
            }
          : null,
      };

      setOptimisticMessages((current) => mergeRenderedMessages(current, [optimisticMessage]));

      if (isAtBottomRef.current) {
        requestAnimationFrame(scrollToBottom);
      }

      sendQueueRef.current = sendQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const formData = new FormData();
            formData.set("text", text ?? "");

            if (imageFile) {
              formData.set("image", imageFile);
            }

            const result = await createMessageFormAction(initialMessageComposerState, formData);

            if (result.success && result.message) {
              const previewUrl = objectUrlByClientIdRef.current.get(clientId);

              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                objectUrlByClientIdRef.current.delete(clientId);
              }

              setOptimisticMessages((current) =>
                current.map((message) =>
                  message.clientId === clientId
                    ? {
                        ...result.message,
                        clientId,
                        deliveryStatus: "sent",
                        errorMessage: null,
                        isOptimistic: true,
                      }
                    : message,
                ),
              );

              return;
            }

            setOptimisticMessages((current) =>
              current.map((message) =>
                message.clientId === clientId
                  ? {
                      ...message,
                      deliveryStatus: "failed",
                      errorMessage: result.error ?? "Не удалось отправить сообщение. Попробуйте позже",
                    }
                  : message,
              ),
            );
          } catch (error) {
            setOptimisticMessages((current) =>
              current.map((message) =>
                message.clientId === clientId
                  ? {
                      ...message,
                      deliveryStatus: "failed",
                      errorMessage:
                        error instanceof Error
                          ? error.message
                          : "Не удалось отправить сообщение. Попробуйте позже",
                    }
                  : message,
              ),
            );
          }
        });
    },
    [currentUserAvatarUrl, currentUserId, scrollToBottom, userDisplayName],
  );

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
          className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4"
          onScroll={handleScroll}
        >
          <LiveMessageList
            currentUserId={currentUserId}
            initialCursor={initialCursor}
            initialHasMore={initialHasMore}
            initialMessages={initialMessages}
            optimisticMessages={optimisticMessages}
            scrollContainerRef={scrollRef}
            onRealtimeInsert={handleRealtimeInsert}
            onEditMessage={handleRequestEdit}
            onDeleteMessage={handleRequestDelete}
          />

          {unseenCount > 0 && !isAtBottom ? (
            <div className="pointer-events-none sticky bottom-3 left-0 right-0 flex justify-center">
              <button
                aria-label="Прокрутить к новым сообщениям"
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#2B5278] px-4 py-2 text-sm font-semibold text-[#E6EEF7] shadow-lg shadow-black/20 transition hover:bg-[#336192] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                type="button"
                onClick={() => {
                  scrollToBottom();
                  setUnseenCount(0);
                }}
              >
                <span aria-hidden="true">↓</span>
                <span>{unseenCount} новых</span>
              </button>
            </div>
          ) : null}
        </section>

        <footer
          ref={composerRef}
          className="shrink-0 border-t border-[#22303D] bg-[#17212B] px-3 py-2 sm:px-4"
        >
          <div className="max-h-[160px] overflow-y-auto">
            {editDraft ? (
              <MessageComposer
                key={`edit-${editDraft.messageId}`}
                mode="edit"
                editingMessageId={editDraft.messageId}
                initialText={editDraft.initialText}
                editingMessageHasImage={editDraft.editingMessageHasImage}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
              />
            ) : (
              <MessageComposer key="compose" onSubmitMessage={handleSubmitMessage} />
            )}
          </div>
        </footer>
      </div>

      <ConfirmDeleteDialog
        open={modalState?.type === "delete-confirm"}
        messageId={modalState?.type === "delete-confirm" ? modalState.messageId : null}
        loading={deleteLoading}
        error={deleteError}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />
    </main>
  );
}

