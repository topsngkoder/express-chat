"use client";

import { useState } from "react";

import { MessageComposer, type ComposerFeedback } from "@/components/chat/message-composer";
import { NotificationPermissionCard } from "@/components/chat/notification-permission-card";

const toneClassName: Record<NonNullable<ComposerFeedback>["tone"], string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300",
  success:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
};

export function ChatFeedbackSections() {
  const [feedback, setFeedback] = useState<ComposerFeedback>(null);

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Форма отправки</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Отправьте текст, изображение или оба варианта сразу. Изображение можно убрать до
            отправки.
          </p>
        </div>

        <MessageComposer onFeedbackChange={setFeedback} />
      </section>

      <NotificationPermissionCard />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Системные уведомления</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Здесь отображаются ошибки отправки и текущие состояния формы.
          </p>
        </div>

        <div className="mt-4">
          {feedback ? (
            <p className={`rounded-xl border px-4 py-3 text-sm ${toneClassName[feedback.tone]}`}>
              {feedback.message}
            </p>
          ) : (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              Пока нет новых уведомлений. Ошибки отправки и статусы формы появятся здесь.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
