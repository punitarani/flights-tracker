/**
 * Sentry initialization and utilities for Cloudflare Workers
 * Provides error tracking, performance monitoring, and logging integration
 */

import type { Options } from "@sentry/cloudflare";
import type { WorkerEnv } from "../env";

/**
 * Returns Sentry configuration options for worker initialization
 * Uses environment variables and version metadata from Cloudflare
 */
export function getSentryOptions(env: WorkerEnv): Partial<Options> {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",

    // Enable performance tracing
    tracesSampleRate: env.SENTRY_ENVIRONMENT === "production" ? 0.2 : 1.0,

    // Enable logging integration
    enableLogs: true,

    // Send user IP and request headers for better debugging
    sendDefaultPii: true,

    // Add release tracking if version metadata is available
    release: env.CF_VERSION_METADATA?.id,

    // Disable debug logging in production
    debug: env.SENTRY_ENVIRONMENT !== "production",

    // Add integrations for better error context
    integrations: [
      // Console logging integration is automatically added
    ],
  };
}

/**
 * Check if Sentry is enabled based on environment variables
 */
export function isSentryEnabled(env: WorkerEnv): boolean {
  return Boolean(env.SENTRY_DSN);
}
