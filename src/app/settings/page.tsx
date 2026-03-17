import type { Metadata } from "next";
import Link from "next/link";
import { isRedirectError } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationPermissionCard } from "@/components/chat/notification-permission-card";
import { ProfileBlock } from "@/components/settings/profile-block";
import { requireConfirmedUser } from "@/lib/auth/require-confirmed-user";
import { getOrCreateCurrentProfile, getAvatarSignedUrl } from "@/lib/profile/profile-service";

export const metadata: Metadata = {
  title: "Настройки",
  description: "Настройки профиля и уведомлений",
};

export default async function SettingsPage() {
  let user: { id: string; email: string };
  let profile: { displayName: string | null; avatarPath: string | null };
  let avatarSignedUrl: string | null = null;

  try {
    user = await requireConfirmedUser();
    profile = await getOrCreateCurrentProfile();
    try {
      avatarSignedUrl = await getAvatarSignedUrl(profile.avatarPath);
    } catch {
      // Не ломаем страницу при сбое Storage: показываем профиль без картинки аватара
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return (
      <main className="min-h-screen bg-zinc-50 px-3 py-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
            <Link
              href="/chat"
              className="inline-flex w-fit items-center text-sm font-medium text-zinc-600 underline decoration-zinc-400 underline-offset-2 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              В чат
            </Link>
            <h1 className="text-2xl font-semibold sm:text-3xl">Настройки</h1>
          </header>
          <section
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
            role="alert"
          >
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Не удалось загрузить настройки. Проверьте подключение к интернету и попробуйте снова.
            </p>
            <Link
              href="/settings"
              className="mt-3 inline-block text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
            >
              Обновить страницу
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-3 py-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <Link
            href="/chat"
            className="inline-flex w-fit items-center text-sm font-medium text-zinc-600 underline decoration-zinc-400 underline-offset-2 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            В чат
          </Link>
          <h1 className="text-2xl font-semibold sm:text-3xl">Настройки</h1>
        </header>

        <ProfileBlock
          initialDisplayName={profile.displayName}
          initialAvatarSignedUrl={avatarSignedUrl}
          userEmail={user.email}
        />

        <NotificationPermissionCard />

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <LogoutButton className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800" />
        </div>
      </div>
    </main>
  );
}
