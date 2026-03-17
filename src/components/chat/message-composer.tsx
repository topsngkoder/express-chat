"use client";

import { useRef, useState, useTransition, useEffect, type ChangeEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import { createMessageFormAction, type MessageComposerState } from "@/lib/actions/messages";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  clientImagePrecheck,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/validation/image";

const initialMessageComposerState: MessageComposerState = {
  success: false,
  error: null,
};

type SelectedImage = {
  name: string;
  size: number;
};

export type ComposerFeedback =
  | {
      tone: "info" | "success" | "error";
      message: string;
    }
  | null;

/** Высота одной строки textarea (text-sm leading-5 ≈ 20px). */
const TEXTAREA_LINE_HEIGHT_PX = 20;
/** Максимум строк без внутреннего скролла (далее overflow). */
const TEXTAREA_MAX_LINES = 5;
const TEXTAREA_MAX_HEIGHT_PX = TEXTAREA_LINE_HEIGHT_PX * TEXTAREA_MAX_LINES + 16; // + py-2

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} КБ`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export function MessageComposer({
  onFeedbackChange,
}: {
  onFeedbackChange?: (feedback: ComposerFeedback) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [serverState, setServerState] = useState(initialMessageComposerState);
  const [clientError, setClientError] = useState<string | null>(null);

  const hasContent = text.trim().length > 0 || selectedImage !== null;
  const errorMessage = clientError ?? serverState.error;

  function adjustTextareaHeight() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const h = Math.max(40, Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT_PX));
    ta.style.height = `${h}px`;
    ta.style.overflowY = ta.scrollHeight > TEXTAREA_MAX_HEIGHT_PX ? "auto" : "hidden";
  }

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return; // Shift+Enter — новая строка
    event.preventDefault();
    if (!hasContent || pending) return;
    const form = event.currentTarget.form;
    if (form) form.requestSubmit();
  }

  function handleSelectImage() {
    fileInputRef.current?.click();
  }

  function handleRemoveImage() {
    const removedImage = selectedImage;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setSelectedImage(null);
    setClientError(null);
    setServerState(initialMessageComposerState);

    if (removedImage) {
      onFeedbackChange?.({
        tone: "info",
        message: "Изображение удалено из сообщения",
      });
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      setSelectedImage(null);
      return;
    }

    const precheck = clientImagePrecheck(file);
    if (!precheck.valid) {
      event.currentTarget.value = "";
      setSelectedImage(null);
      setClientError(precheck.message);
      onFeedbackChange?.({
        tone: "error",
        message: precheck.message,
      });
      return;
    }

    setSelectedImage({
      name: file.name,
      size: file.size,
    });
    setClientError(null);
    setServerState(initialMessageComposerState);
    onFeedbackChange?.({
      tone: "info",
      message: "Изображение выбрано и готово к отправке",
    });
  }

  function handleSubmit(formData: FormData) {
    setClientError(null);
    setServerState(initialMessageComposerState);

    if (!selectedImage) {
      formData.delete("image");
    }

    onFeedbackChange?.({
      tone: "info",
      message: "Отправляем сообщение...",
    });

    startTransition(async () => {
      const result = await createMessageFormAction(initialMessageComposerState, formData);
      setServerState(result);

      if (!result.success) {
        onFeedbackChange?.({
          tone: "error",
          message: result.error ?? "Не удалось отправить сообщение. Попробуйте позже",
        });
        return;
      }

      setText("");
      setSelectedImage(null);
      setClientError(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onFeedbackChange?.({
        tone: "success",
        message: "Сообщение отправлено",
      });
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <input
        ref={fileInputRef}
        accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
        className="hidden"
        name="image"
        onChange={handleImageChange}
        type="file"
      />

      <div className="flex items-center gap-2 rounded-2xl bg-[#1F2C3A] px-2 py-2">
        <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#8FA1B3] transition hover:bg-white/5 hover:text-[#E6EEF7] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          disabled={pending}
          onClick={handleSelectImage}
          type="button"
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
              d="M12.5 6.5 7.8 11.2a3 3 0 0 0 4.2 4.2l6.4-6.4a4.5 4.5 0 0 0-6.4-6.4L5.6 9"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
          <span className="sr-only">
            {selectedImage ? "Заменить изображение" : "Прикрепить изображение"}
          </span>
        </button>

        <textarea
          ref={textareaRef}
          className="min-h-10 w-full flex-1 resize-none overflow-y-hidden bg-transparent px-2 py-2 text-sm leading-5 text-[#E6EEF7] outline-none placeholder:text-[#607382] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          id="message-text"
          maxLength={1000}
          name="text"
          rows={1}
          onChange={(event) => {
            setText(event.currentTarget.value);
            setServerState(initialMessageComposerState);
          }}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Сообщение..."
          value={text}
        />

        <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2B5278] text-[#E6EEF7] transition hover:bg-[#336192] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          disabled={pending || !hasContent}
          type="submit"
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
              d="M3.5 10.5 20 3.5 13 20l-2.7-6.3L3.5 10.5Z"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <path
              d="M10.3 13.7 20 3.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
          <span className="sr-only">{pending ? "Отправка..." : "Отправить"}</span>
        </button>
      </div>

      {selectedImage ? (
        <div className="rounded-2xl border border-[#22303D] bg-[#17212B] px-4 py-3 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium text-[#E6EEF7]">{selectedImage.name}</p>
              <p className="text-[#8FA1B3]">{formatFileSize(selectedImage.size)}</p>
            </div>

            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#22303D] px-4 py-2 text-sm font-medium text-[#E6EEF7] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              disabled={pending}
              onClick={handleRemoveImage}
              type="button"
            >
              Удалить изображение
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-[#5A1E24] bg-[#2A1214] px-4 py-3 text-sm text-[#F5B7B1]">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
