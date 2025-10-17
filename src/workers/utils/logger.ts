/**
 * Simple logger for Cloudflare Workers
 * Wrapper around console with structured data
 */

type LogLevel = "info" | "warn" | "error";

type LogAttributes = Record<string, unknown>;

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
}

export const workerLogger = {
  info: (message: string, data?: LogAttributes) => log("info", message, data),
  warn: (message: string, data?: LogAttributes) => log("warn", message, data),
  error: (message: string, data?: LogAttributes) => log("error", message, data),
};
