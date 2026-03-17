import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создание аккаунта для общего чата",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Регистрация</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Создайте аккаунт, чтобы получить доступ к общему чату после подтверждения email.
          </p>
        </div>

        <div className="mt-6">
          <RegisterForm />
        </div>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Уже есть аккаунт?{" "}
          <Link className="font-medium text-zinc-950 underline dark:text-zinc-50" href="/login">
            Войти
          </Link>
        </p>
      </section>
    </main>
  );
}
