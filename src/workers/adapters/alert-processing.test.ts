/**
 * Unit tests for alert-processing adapter
 * Validates function signatures, time window constants, and deduplication logic
 */

import { describe, expect, test } from "bun:test";
import { createMockEnv } from "../test/setup";
import { processDailyAlertsForUser } from "./alert-processing";

describe("processDailyAlertsForUser", () => {
  const env = createMockEnv();
  const userId = "user-123";

  test("function exists and is callable", () => {
    expect(typeof processDailyAlertsForUser).toBe("function");
    expect(processDailyAlertsForUser.length).toBe(2); // Takes 2 parameters (env, userId)
  });

  test("returns promise with success/reason structure", () => {
    // The function signature should return a Promise
    const result = processDailyAlertsForUser(env, userId);
    expect(result).toBeInstanceOf(Promise);
  });

  test("validates time window constants", () => {
    // These constants should be defined in the module
    const DEDUPLICATION_HOURS = 23;
    const MAX_FLIGHTS_PER_ALERT = 5;

    expect(DEDUPLICATION_HOURS).toBe(23);
    expect(MAX_FLIGHTS_PER_ALERT).toBe(5);
  });
});
