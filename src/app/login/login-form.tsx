"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { LoginFormState } from "@/lib/actions/auth";
import { loginFormAction } from "@/lib/actions/auth";

const initialLoginFormState: LoginFormState = {
  success: false,
  email: "",
  error: null,
};

export function LoginForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    loginFormAction,
    initialLoginFormState,
  );

  useEffect(() => {
    if (!state.success) {
      return;
    }

    router.replace("/chat");
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-100"
          defaultValue={state.email}
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="password">
          Пароль
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-100"
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          placeholder="Введите пароль"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
        disabled={pending}
        type="submit"
      >
        {pending ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
