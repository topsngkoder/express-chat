import { AppError } from "@/lib/errors";

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type AuthLikeError = {
  status?: number;
  code?: string;
  message?: string;
  name?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function mapSupabaseError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  // Auth errors
  if (isRecord(err)) {
    const a = err as AuthLikeError;
    const status = typeof a.status === "number" ? a.status : undefined;
    if (status === 401) {
      return new AppError({ code: "UNAUTHORIZED", publicMessage: "Требуется вход", cause: err });
    }
    if (status === 403) {
      return new AppError({ code: "FORBIDDEN", publicMessage: "Доступ запрещен", cause: err });
    }
  }

  // Postgrest/storage-like errors (shape-based; без утечки сырого текста)
  if (isRecord(err)) {
    const p = err as PostgrestLikeError;
    const code = typeof p.code === "string" ? p.code : null;

    // Postgres unique_violation
    if (code === "23505") {
      return new AppError({ code: "CONFLICT", publicMessage: "Данные уже существуют", cause: err });
    }
  }

  return new AppError({
    code: "UPSTREAM",
    publicMessage: "Не удалось выполнить операцию. Попробуйте позже",
    cause: err,
  });
}

