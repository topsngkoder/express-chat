import type { Metadata } from "next";
import Link from "next/link";

import { ResendEmailForm } from "./resend-email-form";

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    email?: string;
    sent?: string;
    cooldownUntil?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Подтвердите email",
  description: "Ожидание подтверждения адреса электронной почты",
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const email = params?.email?.trim();
  const justSent = params?.sent === "1";
  const parsedCooldownUntil = Number(params?.cooldownUntil ?? "0");
  const initialCooldownUntil = Number.isFinite(parsedCooldownUntil)
    ? parsedCooldownUntil
    : 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">Подтвердите email</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Мы отправили письмо со ссылкой для подтверждения. После подтверждения вы сможете войти в общий чат.
          </p>
          {email ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Адрес: <span className="font-medium text-zinc-950 dark:text-zinc-50">{email}</span>
            </p>
          ) : null}
        </div>

        <ResendEmailForm
          email={email}
          initialCooldownUntil={initialCooldownUntil}
          justSent={justSent}
        />

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Уже подтвердили адрес?{" "}
          <Link className="font-medium text-zinc-950 underline dark:text-zinc-50" href="/login">
            Перейти ко входу
          </Link>
        </p>
      </section>
    </main>
  );
}
