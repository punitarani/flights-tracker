/**
 * Simple logger for Cloudflare Workers
 * Wrapper around console with structured data and Sentry integration
 */

import * as Sentry from "@sentry/cloudflare";

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

  // Send to console (for Cloudflare logs)
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }

  // Send to Sentry
  if (level === "error") {
    // Capture errors with full context
    const error =
      data?.error instanceof Error ? data.error : new Error(message);
    Sentry.captureException(error, {
      level: "error",
      extra: data,
      tags: {
        logger: "worker",
      },
    });
  } else if (level === "warn") {
    // Add warning breadcrumb
    Sentry.addBreadcrumb({
      category: "log",
      message,
      level: "warning",
      data,
    });
  } else {
    // Add info breadcrumb
    Sentry.addBreadcrumb({
      category: "log",
      message,
      level: "info",
      data,
    });
  }
}

export const workerLogger = {
  info: (message: string, data?: LogAttributes) => log("info", message, data),
  warn: (message: string, data?: LogAttributes) => log("warn", message, data),
  error: (message: string, data?: LogAttributes) => log("error", message, data),
};
