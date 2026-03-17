import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    logoutError?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в общий чат по email и паролю",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const hasLogoutError = params?.logoutError === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Вход</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Войдите по email и паролю, чтобы перейти в общий чат.
          </p>
        </div>

        {hasLogoutError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            Не удалось выйти. Попробуйте позже
          </p>
        ) : null}

        <div className="mt-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Еще нет аккаунта?{" "}
          <Link className="font-medium text-zinc-950 underline dark:text-zinc-50" href="/register">
            Зарегистрироваться
          </Link>
        </p>
      </section>
    </main>
  );
}
