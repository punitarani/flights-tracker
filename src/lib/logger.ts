import * as Sentry from "@sentry/nextjs";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogAttributes = Record<string, unknown> & {
  error?: unknown;
};

const fallbackConsole: Record<
  LogLevel,
  (message?: unknown, ...optionalParams: unknown[]) => void
> = {
  trace: console.trace.bind(console),
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  fatal: console.error.bind(console),
};

function withErrorExtraction(attributes: LogAttributes | undefined) {
  if (!attributes) return { cleaned: undefined, error: undefined } as const;

  const { error, ...rest } = attributes;

  if (error instanceof Error) {
    return {
      cleaned: {
        ...rest,
        error: {
          name: error.name,
          message: error.message,
        },
      },
      error,
    } as const;
  }

  return { cleaned: attributes, error: undefined } as const;
}

function log(level: LogLevel, message: string, attributes?: LogAttributes) {
  const { cleaned, error } = withErrorExtraction(attributes);

  const logger = (
    Sentry as unknown as {
      logger?: Partial<
        Record<LogLevel, (msg: string, attrs?: Record<string, unknown>) => void>
      >;
    }
  ).logger;

  if (logger?.[level]) {
    logger[level]?.(message, cleaned);
  } else {
    const fallback = fallbackConsole[level];
    if (cleaned) {
      fallback(message, cleaned);
    } else {
      fallback(message);
    }
  }

  if (error) {
    Sentry.captureException(error, { extra: cleaned ?? {} });
  }
}

export const logger = {
  trace: (message: string, attributes?: LogAttributes) =>
    log("trace", message, attributes),
  debug: (message: string, attributes?: LogAttributes) =>
    log("debug", message, attributes),
  info: (message: string, attributes?: LogAttributes) =>
    log("info", message, attributes),
  warn: (message: string, attributes?: LogAttributes) =>
    log("warn", message, attributes),
  error: (message: string, attributes?: LogAttributes) =>
    log("error", message, attributes),
  fatal: (message: string, attributes?: LogAttributes) =>
    log("fatal", message, attributes),
};

export type Logger = typeof logger;
