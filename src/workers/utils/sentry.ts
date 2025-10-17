/**
 * Sentry utilities for Cloudflare Workers
 * Provides error tracking, performance monitoring, and structured logging
 */

import * as Sentry from "@sentry/cloudflare";
import type { WorkerEnv } from "../env";

export function getSentryOptions(env: WorkerEnv) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    
    // Performance monitoring
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    
    // Enable application logs integration
    enableLogs: true,
    
    // Workflow tracking
    enableWorkflows: true,
    
    // Better error grouping
    beforeSend: (event) => {
      // Add custom fingerprinting for better grouping
      if (event.exception?.values?.[0]) {
        const error = event.exception.values[0];
        event.fingerprint = [
          error.type || 'Error',
          error.value || 'unknown',
          event.transaction || 'unknown',
        ];
      }
      return event;
    },
    
    // Integration options
    integrations: [
      // Enable default integrations
    ],
  };
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
