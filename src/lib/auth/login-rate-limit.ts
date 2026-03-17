import "server-only";

import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const LOGIN_RATE_LIMIT_ERROR = "Слишком много попыток входа. Попробуйте позже";
const LOGIN_RATE_LIMIT_GENERIC_ERROR = "Не удалось выполнить вход. Попробуйте позже";

type LoginRateLimitStatus = {
  isBlocked: boolean;
  blockedUntil: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isLoginRateLimitStatus(value: unknown): value is LoginRateLimitStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.isBlocked === "boolean" &&
    (typeof candidate.blockedUntil === "string" || candidate.blockedUntil === null)
  );
}

async function runLoginRateLimitRpc(
  functionName: "check_login_rate_limit" | "register_failed_login_attempt",
  email: string,
): Promise<LoginRateLimitStatus> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(functionName, {
    target_email: normalizeEmail(email),
  });

  if (error) {
    throw new AppError({
      code: "UPSTREAM",
      publicMessage: LOGIN_RATE_LIMIT_GENERIC_ERROR,
      cause: error,
    });
  }

  if (!isLoginRateLimitStatus(data)) {
    throw new AppError({
      code: "UPSTREAM",
      publicMessage: LOGIN_RATE_LIMIT_GENERIC_ERROR,
      cause: new Error(`Unexpected response from ${functionName}`),
    });
  }

  return data;
}

export async function assertLoginAllowed(email: string): Promise<void> {
  const status = await runLoginRateLimitRpc("check_login_rate_limit", email);

  if (!status.isBlocked) {
    return;
  }

  throw new AppError({
    code: "RATE_LIMIT",
    publicMessage: LOGIN_RATE_LIMIT_ERROR,
  });
}

export async function registerFailedLoginAttempt(email: string): Promise<void> {
  const status = await runLoginRateLimitRpc("register_failed_login_attempt", email);

  if (!status.isBlocked) {
    return;
  }

  throw new AppError({
    code: "RATE_LIMIT",
    publicMessage: LOGIN_RATE_LIMIT_ERROR,
  });
}

export async function clearLoginRateLimit(email: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("clear_login_rate_limit", {
    target_email: normalizeEmail(email),
  });

  if (error) {
    throw new AppError({
      code: "UPSTREAM",
      publicMessage: LOGIN_RATE_LIMIT_GENERIC_ERROR,
      cause: error,
    });
  }
}
