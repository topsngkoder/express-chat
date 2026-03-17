"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseRegisterInput, parseLoginInput } from "@/lib/validation/auth";
import {
  assertLoginAllowed,
  clearLoginRateLimit,
  registerFailedLoginAttempt,
} from "@/lib/auth/login-rate-limit";
import { mapRegisterError, mapLoginError, mapResendError, RESEND_ERROR_MESSAGES } from "@/lib/supabase/map-auth-error";
import { AppError } from "@/lib/errors";
import { logError, logInfo } from "@/lib/logging/app-logger";
import { publicEnv } from "@/env/public";

/** Единый формат успешного ответа auth-операций */
export type AuthSuccess<T = void> = { success: true; data: T };

/** Единый формат ошибки (только прикладное сообщение для UI) */
export type AuthFailure = { success: false; error: string };

export type AuthResult<T> = AuthSuccess<T> | AuthFailure;

export type RegisterFormState = {
  success: boolean;
  email: string;
  error: string | null;
};

export type LoginFormState = {
  success: boolean;
  email: string;
  error: string | null;
};

export type ResendConfirmationFormState = {
  success: boolean;
  error: string | null;
  cooldownUntil: number;
};

/** Throttle повторной отправки письма: не чаще одного раза в 60 секунд на email */
const resendThrottle = new Map<string, number>();
const RESEND_THROTTLE_MS = 60_000;

function checkResendThrottle(email: string): string | null {
  const key = email.toLowerCase().trim();
  const last = resendThrottle.get(key);
  const now = Date.now();
  if (last != null && now - last < RESEND_THROTTLE_MS) {
    return RESEND_ERROR_MESSAGES.tooFrequent;
  }
  resendThrottle.set(key, now);
  return null;
}

export async function registerAction(formData: FormData): Promise<AuthResult<{ email: string }>> {
  try {
    const email = (formData.get("email") ?? "") as string;
    const password = (formData.get("password") ?? "") as string;
    const { email: parsedEmail } = parseRegisterInput({ email, password });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail,
      password,
      options: {
        emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/login`,
      },
    });

    if (error) {
      return { success: false, error: mapRegisterError(error) };
    }

    logInfo("auth.register_succeeded", {
      userId: data.user?.id ?? null,
      email: data.user?.email ?? parsedEmail,
    });

    return {
      success: true,
      data: { email: data.user?.email ?? parsedEmail },
    };
  } catch (e) {
    if (e instanceof AppError && e.code === "VALIDATION") {
      return { success: false, error: e.publicMessage };
    }
    return { success: false, error: mapRegisterError(e) };
  }
}

export async function registerFormAction(
  _previousState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const email = ((formData.get("email") ?? "") as string).trim().toLowerCase();
  const result = await registerAction(formData);

  if (!result.success) {
    return {
      success: false,
      email,
      error: result.error,
    };
  }

  return {
    success: true,
    email: result.data.email,
    error: null,
  };
}

export async function loginAction(formData: FormData): Promise<AuthResult<void>> {
  let parsedEmail = "";

  try {
    const email = (formData.get("email") ?? "") as string;
    const password = (formData.get("password") ?? "") as string;
    ({ email: parsedEmail } = parseLoginInput({ email, password }));

    await assertLoginAllowed(parsedEmail);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsedEmail,
      password,
    });

    if (error) {
      if (mapLoginError(error) === "Неверный email или пароль") {
        await registerFailedLoginAttempt(parsedEmail);
      }

      logError("auth.login_failed", error, {
        email: parsedEmail,
      });

      return { success: false, error: mapLoginError(error) };
    }

    await clearLoginRateLimit(parsedEmail);

    if (data.user && !data.user.email_confirmed_at) {
      logInfo("auth.login_failed", {
        email: parsedEmail,
        userId: data.user.id,
        reason: "email_not_confirmed",
      });

      return { success: false, error: "Email не подтвержден" };
    }

    logInfo("auth.login_succeeded", {
      userId: data.user?.id ?? null,
      email: data.user?.email ?? parsedEmail,
    });

    return { success: true, data: undefined };
  } catch (e) {
    const error = e instanceof AppError ? e : null;

    logError("auth.login_failed", e, {
      email: parsedEmail || null,
      isValidationError: error?.code === "VALIDATION",
      isRateLimited: error?.code === "RATE_LIMIT",
    });

    if (e instanceof AppError && e.code === "VALIDATION") {
      return { success: false, error: e.publicMessage };
    }
    return { success: false, error: mapLoginError(e) };
  }
}

export async function loginFormAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = ((formData.get("email") ?? "") as string).trim().toLowerCase();
  const result = await loginAction(formData);

  if (!result.success) {
    return {
      success: false,
      email,
      error: result.error,
    };
  }

  return {
    success: true,
    email,
    error: null,
  };
}

export async function logoutAction(): Promise<AuthResult<void>> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Не удалось выйти. Попробуйте позже" };
  }
}

export async function logoutFormAction(): Promise<void> {
  const result = await logoutAction();

  if (!result.success) {
    redirect("/login?logoutError=1");
  }

  redirect("/login");
}

export async function resendConfirmationAction(formData: FormData): Promise<AuthResult<void>> {
  try {
    const email = ((formData.get("email") ?? "") as string).trim().toLowerCase();
    if (!email) {
      return { success: false, error: mapResendError(null) };
    }

    const throttleError = checkResendThrottle(email);
    if (throttleError) {
      return { success: false, error: throttleError };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/login`,
      },
    });

    if (error) {
      return { success: false, error: mapResendError(error) };
    }

    return { success: true, data: undefined };
  } catch {
    return { success: false, error: mapResendError(null) };
  }
}

export async function resendConfirmationFormAction(
  previousState: ResendConfirmationFormState,
  formData: FormData,
): Promise<ResendConfirmationFormState> {
  const result = await resendConfirmationAction(formData);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      cooldownUntil: previousState.cooldownUntil,
    };
  }

  return {
    success: true,
    error: null,
    cooldownUntil: Date.now() + RESEND_THROTTLE_MS,
  };
}
