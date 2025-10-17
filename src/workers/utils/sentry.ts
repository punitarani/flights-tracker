/**
 * Sentry utilities for Cloudflare Workers
 * Uses @sentry/cloudflare with withSentry wrapper in index.ts
 */

import * as Sentry from "@sentry/cloudflare";
import type { WorkerEnv } from "../env";

export function getSentryOptions(env: WorkerEnv) {
  const options = {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    // Sample 100% of transactions for performance monitoring
    tracesSampleRate: 1.0,
    // Enable debug mode for better visibility in development
    debug: env.SENTRY_ENVIRONMENT !== "production",
    // Enable logs integration
    enableLogs: true,
  };

  // Add breadcrumbs integration if available (not present in test mocks)
  if (typeof Sentry.breadcrumbsIntegration === "function") {
    return {
      ...options,
      integrations: [
        Sentry.breadcrumbsIntegration({
          console: true,
          fetch: true,
          xhr: true,
        }),
      ],
    };
  }

  return options;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("additional", context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
) {
  Sentry.captureMessage(message, level);
}

export function setUser(userId: string) {
  Sentry.setUser({ id: userId });
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}

export function setTag(key: string, value: string | number) {
  Sentry.setTag(key, value);
}

// Re-export for convenience
export { Sentry };
