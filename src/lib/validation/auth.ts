import { AppError } from "@/lib/errors";
import { z } from "zod";

export const AUTH_ERROR_MESSAGES = {
  invalidEmail: "Введите корректный email",
  invalidPasswordLength: "Пароль должен содержать от 8 до 128 символов",
} as const;

export const emailSchema = z.string().trim().email(AUTH_ERROR_MESSAGES.invalidEmail);

export const passwordSchema = z
  .string()
  .min(8, AUTH_ERROR_MESSAGES.invalidPasswordLength)
  .max(128, AUTH_ERROR_MESSAGES.invalidPasswordLength);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;

function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? AUTH_ERROR_MESSAGES.invalidEmail;
}

export function parseRegisterInput(input: unknown): RegisterInput {
  const res = registerInputSchema.safeParse(input);
  if (!res.success) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: firstIssueMessage(res.error),
      cause: res.error,
    });
  }
  return res.data;
}

export function parseLoginInput(input: unknown): LoginInput {
  const res = loginInputSchema.safeParse(input);
  if (!res.success) {
    throw new AppError({
      code: "VALIDATION",
      publicMessage: firstIssueMessage(res.error),
      cause: res.error,
    });
  }
  return res.data;
}

