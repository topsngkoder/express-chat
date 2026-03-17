import { AppError } from "@/lib/errors";

type LogLevel = "info" | "error";
type LogValue = string | number | boolean | null | undefined;

type LogFields = Record<string, LogValue>;

function serializeError(error: unknown): LogFields {
  if (error instanceof AppError) {
    return {
      errorName: error.name,
      errorCode: error.code,
      errorMessage: error.publicMessage,
    };
  }

  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: "Unknown error",
  };
}

function writeLog(level: LogLevel, event: string, fields: LogFields): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  console.info(message);
}

export function logInfo(event: string, fields: LogFields = {}): void {
  writeLog("info", event, fields);
}

export function logError(event: string, error: unknown, fields: LogFields = {}): void {
  writeLog("error", event, {
    ...fields,
    ...serializeError(error),
  });
}
