"use client";

import {
  useRef,
  useState,
  useTransition,
  useEffect,
  useMemo,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { MessageReplyTo } from "@/lib/messages/rendered-message";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  clientImagePrecheck,
} from "@/lib/validation/image";
import { hashSenderIdToColor } from "@/lib/ui/sender-color";

export type ComposerMode = "compose" | "edit";

export type MessageComposerEditProps = {
  mode: "edit";
  editingMessageId: string;
  initialText: string | null;
  /** При редактировании: разрешить пустой текст, если у сообщения есть изображение */
  editingMessageHasImage?: boolean;
  onSaveEdit: (text: string) => void | Promise<void>;
  onCancelEdit: () => void;
};

export type MessageComposerComposeProps = {
  mode?: "compose";
  onFeedbackChange?: (feedback: ComposerFeedback) => void;
  onSubmitMessage?: (input: MessageComposerSubmitInput) => void | Promise<void>;
  /** Активный ответ на сообщение; передаётся в submit и в reply panel. */
  replyDraft?: MessageReplyTo | null;
  onCancelReply?: () => void;
};

export type MessageComposerSubmitInput = {
  text: string | null;
  imageFile: File | null;
  /** Snapshot ответа на сообщение для optimistic UI и formData. */
  replyDraft?: MessageReplyTo | null;
};

type SelectedImage = {
  name: string;
  size: number;
  file: File;
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

export type MessageComposerProps = (MessageComposerEditProps | MessageComposerComposeProps) & {
  onFeedbackChange?: (feedback: ComposerFeedback) => void;
};

export function MessageComposer(props: MessageComposerProps) {
  const {
    mode = "compose",
    onFeedbackChange,
  } = props;

  const isEditMode = mode === "edit";
  const editProps = isEditMode ? (props as MessageComposerEditProps) : null;
  const composeProps = !isEditMode ? (props as MessageComposerComposeProps) : null;
  const initialText = isEditMode ? (editProps?.initialText ?? "") : "";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(initialText);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  /** На тач-устройствах Enter вставляет новую строку, отправка только по кнопке. */
  const [enterKeySends, setEnterKeySends] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return !window.matchMedia("(pointer: coarse)").matches;
  });

  const hasContent = text.trim().length > 0 || selectedImage !== null;
  const previewUrl = useMemo(
    () => (selectedImage ? URL.createObjectURL(selectedImage.file) : null),
    [selectedImage],
  );

  useEffect(() => {
    const m = window.matchMedia("(pointer: coarse)");
    const handler = () => setEnterKeySends(!m.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const errorMessage = clientError;
  const isBusy = isEditMode ? pending : false;

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

  function keepTextareaFocus(event: PointerEvent<HTMLButtonElement>) {
    if (document.activeElement === textareaRef.current) {
      event.preventDefault();
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      if (isEditMode && editProps) {
        event.preventDefault();
        editProps.onCancelEdit();
      }
      return;
    }
    if (event.key !== "Enter") return;
    if (event.shiftKey) return; // Shift+Enter — новая строка на десктопе
    // На мобильных (pointer: coarse) Enter вставляет новую строку, отправка только по кнопке
    if (!enterKeySends) return;
    event.preventDefault();
    if (isEditMode) {
      if (!isBusy && editProps) handleSaveEdit();
      return;
    }
    if (!hasContent || isBusy) return;
    void handleComposeSubmit();
  }

  function handleSaveEdit() {
    if (!editProps) return;
    const trimmed = text.trim();
    const initialTrimmed = (editProps.initialText ?? "").trim();
    if (trimmed.length === 0 && !editProps.editingMessageHasImage) {
      setClientError("Сообщение не может быть пустым");
      onFeedbackChange?.({ tone: "error", message: "Сообщение не может быть пустым" });
      return;
    }
    if (trimmed === initialTrimmed) {
      editProps.onCancelEdit();
      return;
    }
    setClientError(null);
    startTransition(async () => {
      try {
        await editProps!.onSaveEdit(trimmed);
        editProps!.onCancelEdit();
      } catch (e) {
        setClientError(e instanceof Error ? e.message : "Не удалось сохранить изменения");
      }
    });
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
    if (removedImage) {
      onFeedbackChange?.({
        tone: "info",
        message: "Изображение удалено из сообщения",
      });
    }

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    if (isBusy) {
      event.currentTarget.value = "";
      return;
    }
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
      file,
    });
    setClientError(null);
    onFeedbackChange?.({
      tone: "info",
      message: "Изображение выбрано и готово к отправке",
    });

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  async function handleComposeSubmit() {
    if (isEditMode || !composeProps?.onSubmitMessage) return;
    if (!hasContent) return;

    const trimmedText = text.trim();
    setClientError(null);

    onFeedbackChange?.({
      tone: "info",
      message: "Сообщение поставлено в очередь",
    });

    try {
      await composeProps.onSubmitMessage({
        text: trimmedText.length > 0 ? trimmedText : null,
        imageFile: selectedImage?.file ?? null,
        replyDraft: composeProps.replyDraft ?? null,
      });

      setText("");
      setSelectedImage(null);
      setClientError(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Не удалось поставить сообщение в очередь");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isEditMode) {
      if (!isBusy) {
        handleSaveEdit();
      }

      return;
    }

    void handleComposeSubmit();
  }

  return (
    <form
      aria-busy={isBusy}
      className="space-y-2"
      onSubmit={handleSubmit}
    >
      <input
        ref={fileInputRef}
        accept={ALLOWED_IMAGE_MIME_TYPES.join(",")}
        className="hidden"
        name="image"
        onChange={handleImageChange}
        type="file"
      />

      <div className="rounded-2xl bg-[#1F2C3A]">
        {!isEditMode && composeProps?.replyDraft ? (
          <div className="flex items-start justify-between gap-3 border-b border-[#22303D] px-2 py-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 h-9 w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: hashSenderIdToColor(composeProps.replyDraft.senderId) }}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#8FA1B3]">
                  В ответ {composeProps.replyDraft.senderName}
                </p>
                <p className="truncate text-sm text-[#E6EEF7]">
                  {composeProps.replyDraft.previewText}
                </p>
              </div>
            </div>
            <button
              aria-label="Отменить ответ"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#8FA1B3] transition hover:bg-white/10 hover:text-[#E6EEF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              onClick={() => composeProps.onCancelReply?.()}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="18"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6 6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        ) : null}
        {isEditMode ? (
          <div className="flex items-center justify-between gap-2 border-b border-[#22303D] px-2 py-1.5">
            <span className="text-sm text-[#8FA1B3]">Редактирование сообщения</span>
            <div className="flex items-center gap-1">
              <button
                aria-label="Отменить редактирование"
                className="rounded-lg px-3 py-1.5 text-sm text-[#8FA1B3] transition hover:bg-white/10 hover:text-[#E6EEF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy}
                onClick={() => editProps?.onCancelEdit()}
                type="button"
              >
                Отмена
              </button>
              <button
                aria-label="Сохранить изменения"
                className="rounded-lg bg-[#2B5278] px-3 py-1.5 text-sm text-[#E6EEF7] transition hover:bg-[#336192] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy}
                onClick={() => handleSaveEdit()}
                type="button"
              >
                Сохранить
              </button>
            </div>
          </div>
        ) : null}
        {!isEditMode && selectedImage ? (
          <div className="flex items-center gap-2 border-b border-[#22303D] px-2 py-1.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#17212B]">
              {previewUrl ? (
                <img
                  alt=""
                  className="h-full w-full object-cover"
                  height={40}
                  src={previewUrl}
                  width={40}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#E6EEF7]">
                {selectedImage.name}
              </p>
              <p className="text-xs text-[#8FA1B3]">{formatFileSize(selectedImage.size)}</p>
            </div>
            <button
              aria-label="Удалить изображение из сообщения"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8FA1B3] transition hover:bg-white/10 hover:text-[#E6EEF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
              onClick={handleRemoveImage}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                height="16"
                viewBox="0 0 24 24"
                width="16"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18 6 6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2 px-2 py-2">
          {!isEditMode ? (
            <button
              aria-label={selectedImage ? "Заменить изображение" : "Прикрепить изображение"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#8FA1B3] transition hover:bg-white/5 hover:text-[#E6EEF7] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
              disabled={isBusy}
              onClick={handleSelectImage}
              onPointerDown={keepTextareaFocus}
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
            </button>
          ) : null}

          <textarea
          ref={textareaRef}
          className="min-h-10 w-full flex-1 resize-none overflow-y-hidden bg-transparent px-2 py-2 text-sm leading-5 text-[#E6EEF7] outline-none placeholder:text-[#607382] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          id="message-text"
          maxLength={1000}
          name="text"
          rows={1}
          onChange={(event) => {
            setText(event.currentTarget.value);
          }}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Сообщение..."
          value={text}
        />

        {!isEditMode ? (
          <button
            aria-label="Отправить"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2B5278] text-[#E6EEF7] transition hover:bg-[#336192] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            disabled={!hasContent}
            onPointerDown={keepTextareaFocus}
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
          </button>
        ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-[#5A1E24] bg-[#2A1214] px-4 py-3 text-sm text-[#F5B7B1]">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
