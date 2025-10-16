/**
 * Unit tests for worker logger
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mockConsole } from "../test/setup";
import { setSentryLogger, workerLogger } from "./logger";

describe("workerLogger", () => {
  let consoleMock: ReturnType<typeof mockConsole>;

  beforeEach(() => {
    consoleMock = mockConsole();
  });

  afterEach(() => {
    consoleMock.restore();
  });

  test("logs info messages with structured data", () => {
    workerLogger.info("Test message", { userId: "123", count: 5 });

    expect(consoleMock.logs).toHaveLength(1);
    const logEntry = JSON.parse(consoleMock.logs[0]);

    expect(logEntry.level).toBe("info");
    expect(logEntry.message).toBe("Test message");
    expect(logEntry.userId).toBe("123");
    expect(logEntry.count).toBe(5);
    expect(logEntry.timestamp).toBeDefined();
  });

  test("logs warning messages", () => {
    workerLogger.warn("Warning message", { reason: "test" });

    expect(consoleMock.warnings).toHaveLength(1);
    const logEntry = JSON.parse(consoleMock.warnings[0]);

    expect(logEntry.level).toBe("warn");
    expect(logEntry.message).toBe("Warning message");
    expect(logEntry.reason).toBe("test");
  });

  test("logs error messages", () => {
    workerLogger.error("Error occurred", { error: "Something went wrong" });

    expect(consoleMock.errors).toHaveLength(1);
    const logEntry = JSON.parse(consoleMock.errors[0]);

    expect(logEntry.level).toBe("error");
    expect(logEntry.message).toBe("Error occurred");
    expect(logEntry.error).toBe("Something went wrong");
  });

  test("logs without additional data", () => {
    workerLogger.info("Simple message");

    expect(consoleMock.logs).toHaveLength(1);
    const logEntry = JSON.parse(consoleMock.logs[0]);

    expect(logEntry.level).toBe("info");
    expect(logEntry.message).toBe("Simple message");
    expect(logEntry.timestamp).toBeDefined();
  });

  test("includes ISO timestamp", () => {
    const beforeLog = new Date().toISOString();
    workerLogger.info("Test");
    const afterLog = new Date().toISOString();

    const logEntry = JSON.parse(consoleMock.logs[0]);
    expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(
      logEntry.timestamp >= beforeLog && logEntry.timestamp <= afterLog,
    ).toBe(true);
  });

  test("forwards logs to Sentry logger when available", () => {
    const sentryInfoCalls: Array<{
      message: string;
      attributes?: Record<string, unknown>;
    }> = [];

    setSentryLogger({
      info: (message: string, attributes?: Record<string, unknown>) => {
        sentryInfoCalls.push({ message, attributes });
      },
    });

    try {
      workerLogger.info("Sentry test", { requestId: "req-123" });

      expect(sentryInfoCalls).toHaveLength(1);
      const [{ message, attributes }] = sentryInfoCalls;
      expect(message).toBe("Sentry test");
      expect(attributes).toBeDefined();
      expect(attributes?.requestId).toBe("req-123");
      expect(attributes?.timestamp).toBeDefined();
    } finally {
      setSentryLogger(undefined);
    }
  });
});
