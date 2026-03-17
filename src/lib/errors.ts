export type AppErrorCode =
  | "UNEXPECTED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UPSTREAM";

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly publicMessage: string;
  public readonly cause?: unknown;

  constructor(params: { code: AppErrorCode; publicMessage: string; cause?: unknown }) {
    super(params.publicMessage);
    this.name = "AppError";
    this.code = params.code;
    this.publicMessage = params.publicMessage;
    this.cause = params.cause;
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  return new AppError({
    code: "UNEXPECTED",
    publicMessage: "Произошла ошибка. Попробуйте позже",
    cause: err,
  });
}

