/**
 * Unit tests for Sentry utilities
 */

import { describe, expect, test } from "bun:test";
import { createMockEnv } from "../test/setup";
import { getSentryOptions } from "./sentry";

describe("Sentry utilities", () => {
  test("getSentryOptions returns null when no DSN", () => {
    const env = createMockEnv({ SENTRY_DSN: undefined });
    const options = getSentryOptions(env);
    expect(options).toBeNull();
  });

  test("getSentryOptions returns config when DSN provided", () => {
    const env = createMockEnv({
      SENTRY_DSN: "https://test@sentry.io/123",
      SENTRY_ENVIRONMENT: "staging",
    });

    const options = getSentryOptions(env);

    expect(options).not.toBeNull();
    expect(options?.dsn).toBe("https://test@sentry.io/123");
    expect(options?.environment).toBe("staging");
    expect(options?.tracesSampleRate).toBe(1.0);
  });

  test("getSentryOptions uses default environment", () => {
    const env = createMockEnv({
      SENTRY_DSN: "https://test@sentry.io/123",
      SENTRY_ENVIRONMENT: undefined,
    });

    const options = getSentryOptions(env);
    expect(options?.environment).toBe("production");
  });

  // Note: Testing Sentry wrapper functions (captureException, setUser, etc.)
  // is difficult due to module readonly properties. These are thin wrappers
  // around Sentry SDK functions that are well-tested by Sentry itself.
  // Integration tests cover the full flow including error capture.
});
