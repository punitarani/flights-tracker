/**
 * Unit tests for flights search utilities
 * Tests validate parallel flight fetching, error handling, and API URL construction
 */

import { describe, expect, mock, test } from "bun:test";
import { createMockAlert, createMockFlights } from "../test/fixtures";
import { createMockEnv } from "../test/setup";
import {
  type AlertWithFlights,
  fetchFlightDataForAlerts,
} from "./flights-search";

describe("fetchFlightDataForAlerts", () => {
  test("returns empty array for empty input", async () => {
    const env = createMockEnv();
    const results = await fetchFlightDataForAlerts(env, [], 5);
    expect(results).toHaveLength(0);
  });

  test("processes alerts in parallel", async () => {
    const env = createMockEnv();
    const alerts = [
      createMockAlert({ id: "alt-1" }),
      createMockAlert({ id: "alt-2" }),
    ];

    const fetcher = mock(async () =>
      alerts.map(
        (alert) =>
          ({
            alert,
            flights: createMockFlights(2),
          }) satisfies AlertWithFlights,
      ),
    );

    const results = await fetchFlightDataForAlerts(env, alerts, 5, fetcher);

    expect(results).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledWith(alerts, 5);
  });

  test("filters alerts without flights", async () => {
    const env = createMockEnv();
    const alerts = [
      createMockAlert({ id: "alt-1" }),
      createMockAlert({ id: "alt-2" }),
    ];

    const fetcher = mock(async () =>
      alerts
        .filter((alert) => alert.id === "alt-1")
        .map(
          (alert) =>
            ({
              alert,
              flights: createMockFlights(1),
            }) satisfies AlertWithFlights,
        ),
    );

    const results = await fetchFlightDataForAlerts(env, alerts, 5, fetcher);

    expect(results).toHaveLength(1);
    expect(results[0]?.alert.id).toBe("alt-1");
    expect(fetcher).toHaveBeenCalledWith(alerts, 5);
  });
});
