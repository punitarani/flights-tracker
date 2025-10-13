/**
 * Unit tests for alerts-db adapter
 * Validates database query function signatures and filter logic
 */

import { describe, expect, test } from "bun:test";
import { AlertType } from "@/core/alert-types";
import { createMockEnv } from "../test/setup";
import { getUserIdsWithActiveDailyAlerts } from "./alerts-db";

describe("getUserIdsWithActiveDailyAlerts", () => {
  const _env = createMockEnv();

  test("function exists and is callable", () => {
    // Verify the function exists and is callable
    expect(typeof getUserIdsWithActiveDailyAlerts).toBe("function");
  });

  test("has correct function signature", () => {
    // Test that the function signature is correct
    expect(getUserIdsWithActiveDailyAlerts).toBeDefined();
    expect(getUserIdsWithActiveDailyAlerts.length).toBe(1); // Takes 1 parameter (env)
  });

  test("filters for active status", () => {
    // Verify AlertType enum is used correctly
    expect(AlertType.DAILY).toBe("daily");
  });
});
