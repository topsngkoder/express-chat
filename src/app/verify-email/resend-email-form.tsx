"use client";

import { useActionState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import type { ResendConfirmationFormState } from "@/lib/actions/auth";
import { resendConfirmationFormAction } from "@/lib/actions/auth";

const initialResendFormState: ResendConfirmationFormState = {
  success: false,
  error: null,
  cooldownUntil: 0,
};

function subscribeToClock(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(intervalId);
}

function getNowSnapshot() {
  return Date.now();
}

function getServerNowSnapshot() {
  return 0;
}

export function ResendEmailForm({
  email,
  justSent,
  initialCooldownUntil,
}: {
  email?: string;
  justSent: boolean;
  initialCooldownUntil: number;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    resendConfirmationFormAction,
    {
      ...initialResendFormState,
      cooldownUntil: initialCooldownUntil,
    },
  );
  const now = useSyncExternalStore(
    subscribeToClock,
    getNowSnapshot,
    getServerNowSnapshot,
  );

  useEffect(() => {
    if (!justSent || !email) {
      return;
    }

    router.replace(`/verify-email?email=${encodeURIComponent(email)}`);
  }, [email, justSent, router]);

  const remainingSeconds = Math.max(0, Math.ceil((state.cooldownUntil - now) / 1000));
  const isDisabled = pending || !email || remainingSeconds > 0;

  return (
    <div className="mt-6 space-y-4">
      <form action={formAction} className="space-y-4">
        <input name="email" type="hidden" value={email ?? ""} />

        <button
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          disabled={isDisabled}
          type="submit"
        >
          {pending
            ? "Отправляем письмо..."
            : remainingSeconds > 0
              ? `Отправить повторно через ${remainingSeconds} сек`
              : "Отправить письмо повторно"}
        </button>
      </form>

      {state.success ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300">
          Письмо отправлено повторно.
        </p>
      ) : null}

      {state.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {!email ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Email не найден. Вернитесь на страницу регистрации и попробуйте снова.
        </p>
      ) : null}
    </div>
  );
}
