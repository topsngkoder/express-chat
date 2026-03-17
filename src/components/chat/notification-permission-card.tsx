"use client";

import { useEffect, useState } from "react";

type NotificationPermissionState = NotificationPermission | "unsupported";

const toneClassName: Record<NotificationPermissionState, string> = {
  default:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300",
  granted:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300",
  denied:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  unsupported:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300",
};

const statusLabel: Record<NotificationPermissionState, string> = {
  default: "Выключены",
  granted: "Включены",
  denied: "Заблокированы",
  unsupported: "Недоступны",
};

function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

export function NotificationPermissionCard() {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [requestPending, setRequestPending] = useState(false);

  useEffect(() => {
    function syncPermission() {
      setPermission(getNotificationPermissionState());
    }

    syncPermission();
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);

    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, []);

  async function handleEnableNotifications() {
    if (permission !== "default" || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    setRequestPending(true);

    try {
      const nextPermission = await window.Notification.requestPermission();
      setPermission(nextPermission);
    } finally {
      setRequestPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Уведомления</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Здесь можно включить браузерные уведомления о новых сообщениях. Они срабатывают, когда
          вкладка с чатом неактивна или окно браузера не в фокусе.
        </p>
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${toneClassName[permission]}`}>
        <p className="font-medium">Статус: {statusLabel[permission]}</p>
        <p className="mt-1">
          {permission === "default"
            ? "Уведомления пока не включены. Разрешите их вручную, когда будете готовы."
            : null}
          {permission === "granted"
            ? "Разрешение получено. Новые сообщения будут приходить, пока чат открыт в браузере, но вкладка неактивна."
            : null}
          {permission === "denied"
            ? "Браузер сейчас блокирует уведомления для этого сайта. Если захотите включить их позже, разрешите уведомления в настройках сайта."
            : null}
          {permission === "unsupported"
            ? "В этом браузере уведомления для сайта недоступны, поэтому дополнительных оповещений здесь не будет."
            : null}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          disabled={permission !== "default" || requestPending}
          onClick={handleEnableNotifications}
          type="button"
        >
          {requestPending ? "Запрашиваем доступ..." : "Включить уведомления"}
        </button>

        {permission === "denied" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Разрешение меняется через настройки сайта в браузере.
          </p>
        ) : null}
      </div>
    </section>
  );
}
