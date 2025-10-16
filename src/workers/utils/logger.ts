/**
 * Simple logger for Cloudflare Workers
 * Wrapper around console with structured data
 */

import { Sentry } from "./sentry";

type LogLevel = "info" | "warn" | "error";

type LogAttributes = Record<string, unknown>;

type SentryLogger = {
  info?: (message: string, attributes?: LogAttributes) => void;
  warn?: (message: string, attributes?: LogAttributes) => void;
  error?: (message: string, attributes?: LogAttributes) => void;
};

let overrideSentryLogger: SentryLogger | undefined;

const resolveSentryLogger = (): SentryLogger | undefined => {
  if (overrideSentryLogger) {
    return overrideSentryLogger;
  }

  return (Sentry as unknown as { logger?: SentryLogger }).logger;
};

export const setSentryLogger = (logger?: SentryLogger) => {
  overrideSentryLogger = logger;
};

function log(level: LogLevel, message: string, data?: LogAttributes) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    level,
    message,
    timestamp,
    ...data,
  };

  const serialized = JSON.stringify(logEntry);

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }

  try {
    const sentryLogger = resolveSentryLogger();
    const attributes: LogAttributes = { timestamp, ...(data ?? {}) };

    if (level === "info") {
      sentryLogger?.info?.(message, attributes);
    } else if (level === "warn") {
      sentryLogger?.warn?.(message, attributes);
    } else if (level === "error") {
      sentryLogger?.error?.(message, attributes);
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Failed to send log to Sentry",
        originalMessage: message,
        originalLevel: level,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export const workerLogger = {
  info: (message: string, data?: LogAttributes) => log("info", message, data),
  warn: (message: string, data?: LogAttributes) => log("warn", message, data),
  error: (message: string, data?: LogAttributes) => log("error", message, data),
};
