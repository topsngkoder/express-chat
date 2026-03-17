"use client";

import { useActionState } from "react";

import {
  saveDisplayNameFormAction,
  uploadAvatarFormAction,
  removeAvatarFormAction,
  type ProfileDisplayNameState,
  type ProfileAvatarState,
} from "@/lib/actions/profile";

const initialDisplayNameState: ProfileDisplayNameState = {
  success: false,
  error: null,
};

const initialAvatarState: ProfileAvatarState = {
  success: false,
  error: null,
};

function getInitials(displayName: string | null, email: string): string {
  const raw = (displayName ?? email).trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0) ?? "";
    const b = parts[1]?.charAt(0) ?? "";
    return (a + b).toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

type ProfileBlockProps = {
  initialDisplayName: string | null;
  initialAvatarSignedUrl: string | null;
  userEmail: string;
};

export function ProfileBlock({
  initialDisplayName,
  initialAvatarSignedUrl,
  userEmail,
}: ProfileBlockProps) {
  const [displayNameState, displayNameAction, displayNamePending] = useActionState(
    saveDisplayNameFormAction,
    initialDisplayNameState,
  );

  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadAvatarFormAction,
    initialAvatarState,
  );

  const [removeState, removeAction, removePending] = useActionState(
    removeAvatarFormAction,
    initialAvatarState,
  );

  const avatarPending = uploadPending || removePending;
  const avatarError = uploadState.error ?? removeState.error;
  const avatarSuccess = uploadState.success || removeState.success;

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
      aria-labelledby="profile-heading"
    >
      <h2 id="profile-heading" className="text-lg font-semibold">
        Профиль
      </h2>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex shrink-0">
          {initialAvatarSignedUrl ? (
            <img
              src={initialAvatarSignedUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-xl font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
              aria-hidden
            >
              {getInitials(initialDisplayName, userEmail)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <form action={displayNameAction} className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="settings-display-name">
              Ник
            </label>
            <input
              defaultValue={initialDisplayName ?? ""}
              disabled={displayNamePending}
              id="settings-display-name"
              name="displayName"
              placeholder={userEmail}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-zinc-950 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-100"
              type="text"
              maxLength={50}
              autoComplete="username"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={displayNamePending}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                {displayNamePending ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
            {displayNameState.error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {displayNameState.error}
              </p>
            )}
            {displayNameState.success && !displayNamePending && (
              <p className="text-sm text-green-600 dark:text-green-400" role="status">
                Ник сохранён.
              </p>
            )}
          </form>

          <div className="space-y-2">
            <span className="block text-sm font-medium">Аватар</span>
            <div className="flex flex-wrap items-center gap-2">
              <form action={uploadAction} className="flex items-center gap-2">
                <label className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800">
                  {uploadPending ? "Загрузка…" : "Выбрать файл"}
                  <input
                    accept="image/*"
                    className="sr-only"
                    disabled={avatarPending}
                    name="avatar"
                    type="file"
                    onChange={(e) => {
                      const form = e.target.form;
                      if (form && e.target.files?.[0]) form.requestSubmit();
                    }}
                  />
                </label>
              </form>
              {initialAvatarSignedUrl && (
                <form action={removeAction}>
                  <button
                    type="submit"
                    disabled={avatarPending}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {removePending ? "Удаление…" : "Удалить аватар"}
                  </button>
                </form>
              )}
            </div>
            {avatarError && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {avatarError}
              </p>
            )}
            {avatarSuccess && !avatarPending && (
              <p className="text-sm text-green-600 dark:text-green-400" role="status">
                Аватар обновлён.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
