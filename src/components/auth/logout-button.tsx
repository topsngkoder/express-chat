import { logoutFormAction } from "@/lib/actions/auth";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <form action={logoutFormAction}>
      <button
        className={
          className ??
          "rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        }
        type="submit"
      >
        Выйти из чата
      </button>
    </form>
  );
}
