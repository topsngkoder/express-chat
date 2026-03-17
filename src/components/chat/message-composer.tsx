"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
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
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [serverState, setServerState] = useState(initialMessageComposerState);
  const [clientError, setClientError] = useState<string | null>(null);

  const hasContent = text.trim().length > 0 || selectedImage !== null;
  const errorMessage = clientError ?? serverState.error;

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
    <form action={handleSubmit} className="mt-4 space-y-4">
      <input
        ref={fileInputRef}
        accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
        className="hidden"
        name="image"
        onChange={handleImageChange}
        type="file"
      />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="message-text">
          Сообщение
        </label>
        <textarea
          className="min-h-28 w-full resize-y rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950/40 dark:focus:border-zinc-100"
          disabled={pending}
          id="message-text"
          maxLength={1000}
          name="text"
          onChange={(event) => {
            setText(event.currentTarget.value);
            setServerState(initialMessageComposerState);
          }}
          placeholder="Напишите сообщение"
          value={text}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          До 1000 символов. Можно отправить текст, одно изображение или оба варианта сразу.
        </p>
      </div>

      {selectedImage ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                {selectedImage.name}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {formatFileSize(selectedImage.size)}
              </p>
            </div>

            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
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
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          className="min-h-11 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          disabled={pending}
          onClick={handleSelectImage}
          type="button"
        >
          {selectedImage ? "Заменить изображение" : "Выбрать изображение"}
        </button>
        <button
          className="min-h-11 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          disabled={pending || !hasContent}
          type="submit"
        >
          {pending ? "Отправка..." : "Отправить"}
        </button>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Поддерживаются JPEG, PNG и WebP до{" "}
        {Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))} МБ.
      </p>
    </form>
  );
}
