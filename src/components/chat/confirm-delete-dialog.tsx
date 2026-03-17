"use client";

import { useEffect, useRef } from "react";

type ConfirmDeleteDialogProps = {
  open: boolean;
  messageId: string | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (messageId: string) => void;
};

export function ConfirmDeleteDialog({
  open,
  messageId,
  loading = false,
  error = null,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (messageId && !loading) {
      onConfirm(messageId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-desc"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-2xl border border-[#22303D] bg-[#17212B] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-delete-title"
          className="text-lg font-semibold text-[#E6EEF7]"
        >
          Удалить сообщение?
        </h2>
        <p
          id="confirm-delete-desc"
          className="mt-2 text-sm text-[#8FA1B3]"
        >
          Сообщение будет удалено у всех участников. Отменить действие нельзя.
        </p>

        {error ? (
          <p
            className="mt-3 rounded-lg bg-[#8B2635]/20 px-3 py-2 text-sm text-[#F07474]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            className="rounded-xl border border-[#22303D] bg-transparent px-4 py-2 text-sm font-medium text-[#E6EEF7] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#4CC9F0] focus:ring-offset-2 focus:ring-offset-[#17212B] disabled:opacity-50"
            onClick={onClose}
            disabled={loading}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#8B2635] px-4 py-2 text-sm font-medium text-white hover:bg-[#A02D40] focus:outline-none focus:ring-2 focus:ring-[#4CC9F0] focus:ring-offset-2 focus:ring-offset-[#17212B] disabled:opacity-50"
            onClick={handleConfirm}
            disabled={loading}
            aria-label="Удалить сообщение"
          >
            {loading ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
