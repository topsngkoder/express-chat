/**
 * Маппинг ошибок Supabase Auth на сообщения из спецификации (разделы 13.1, 13.2).
 * Используется только в серверном слое auth-операций.
 */

/** Сообщения регистрации (13.1) */
export const REGISTER_ERROR_MESSAGES = {
  duplicate: "Пользователь с таким email уже существует",
  generic: "Не удалось зарегистрироваться. Попробуйте позже",
} as const;

/** Сообщения входа (13.2) */
export const LOGIN_ERROR_MESSAGES = {
  invalidCredentials: "Неверный email или пароль",
  emailNotConfirmed: "Email не подтвержден",
  tooManyAttempts: "Слишком много попыток входа. Попробуйте позже",
  generic: "Не удалось выполнить вход. Попробуйте позже",
} as const;

/** Сообщения повторной отправки письма (ожидание пользователя) */
export const RESEND_ERROR_MESSAGES = {
  tooFrequent: "Письмо уже было отправлено. Повторите попытку через минуту.",
  generic: "Не удалось отправить письмо. Попробуйте позже",
} as const;

type AuthLikeError = {
  message?: string;
  code?: string;
  status?: number;
};

function getMessage(err: unknown): string {
  if (err && typeof (err as AuthLikeError).message === "string") {
    return (err as AuthLikeError).message ?? "";
  }
  return "";
}

function getCode(err: unknown): string | undefined {
  if (err && typeof (err as AuthLikeError).code === "string") {
    return (err as AuthLikeError).code;
  }
  return undefined;
}

function getStatus(err: unknown): number | undefined {
  if (err && typeof (err as AuthLikeError).status === "number") {
    return (err as AuthLikeError).status;
  }
  return undefined;
}

export function mapRegisterError(err: unknown): string {
  const msg = getMessage(err).toLowerCase();
  const code = getCode(err);

  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already exists")) {
    return REGISTER_ERROR_MESSAGES.duplicate;
  }
  return REGISTER_ERROR_MESSAGES.generic;
}

export function mapLoginError(err: unknown): string {
  const msg = getMessage(err).toLowerCase();
  const code = getCode(err);
  const status = getStatus(err);

  if (status === 429) {
    return LOGIN_ERROR_MESSAGES.tooManyAttempts;
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return LOGIN_ERROR_MESSAGES.emailNotConfirmed;
  }
  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials")
  ) {
    return LOGIN_ERROR_MESSAGES.invalidCredentials;
  }
  return LOGIN_ERROR_MESSAGES.generic;
}

export function mapResendError(_err: unknown): string {
  return RESEND_ERROR_MESSAGES.generic;
}
