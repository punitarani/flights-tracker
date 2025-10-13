/**
 * Unit tests for flights search utilities
 * Tests validate parallel flight fetching, error handling, and API URL construction
 */

import type { Mock } from "bun:test";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  createMockAlert,
  createMockFlights,
  createMockFlightsApiResponse,
} from "../test/fixtures";
import { createMockEnv, mockFetchResponse } from "../test/setup";
import { fetchFlightDataFromAPI } from "./flights-search";

/**
 * Type helper to access mock function calls with proper typing
 */
type MockFetch = Mock<
  (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
>;

describe("fetchFlightDataFromAPI", () => {
  const env = createMockEnv();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetches flights for single alert", async () => {
    const alert = createMockAlert();
    const mockFlights = createMockFlights(3);
    const apiResponse = createMockFlightsApiResponse(mockFlights);

    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse(apiResponse)),
    );

    const results = await fetchFlightDataFromAPI(env, [alert], 5);

    expect(results).toHaveLength(1);
    expect(results[0].alert.id).toBe(alert.id);
    expect(results[0].flights).toHaveLength(3);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test("fetches flights for multiple alerts in parallel", async () => {
    const alerts = [
      createMockAlert({ id: "alt-1" }),
      createMockAlert({ id: "alt-2" }),
      createMockAlert({ id: "alt-3" }),
    ];

    globalThis.fetch = mock(() =>
      Promise.resolve(
        mockFetchResponse(createMockFlightsApiResponse(createMockFlights(2))),
      ),
    );

    const results = await fetchFlightDataFromAPI(env, alerts, 5);

    expect(results).toHaveLength(3);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  test("limits flights to maxFlights parameter", async () => {
    const alert = createMockAlert();
    const mockFlights = createMockFlights(10);
    const apiResponse = createMockFlightsApiResponse(mockFlights);

    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse(apiResponse)),
    );

    const results = await fetchFlightDataFromAPI(env, [alert], 3);

    expect(results[0].flights).toHaveLength(3);
  });

  test("filters flights by price limit", async () => {
    const alert = createMockAlert({
      filters: {
        version: "v1" as const,
        route: { from: "JFK", to: "LAX" },
        filters: { price: 450 },
      },
    });

    const mockFlights = [
      { ...createMockFlights(1)[0], totalPrice: 400 }, // Should be included
      { ...createMockFlights(1)[0], totalPrice: 500 }, // Should be filtered out
      { ...createMockFlights(1)[0], totalPrice: 450 }, // Should be included
    ];

    globalThis.fetch = mock(() =>
      Promise.resolve(
        mockFetchResponse(createMockFlightsApiResponse(mockFlights)),
      ),
    );

    const results = await fetchFlightDataFromAPI(env, [alert], 5);

    expect(results[0].flights).toHaveLength(2);
    expect(results[0].flights.every((f) => f.totalPrice <= 450)).toBe(true);
  });

  test("excludes alerts with no matching flights", async () => {
    const alerts = [
      createMockAlert({ id: "alt-1" }),
      createMockAlert({ id: "alt-2" }),
    ];

    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount++;
      // First call returns flights, second returns empty
      if (callCount === 1) {
        return Promise.resolve(
          mockFetchResponse(createMockFlightsApiResponse(createMockFlights(2))),
        );
      }
      return Promise.resolve(
        mockFetchResponse(createMockFlightsApiResponse([])),
      );
    });

    const results = await fetchFlightDataFromAPI(env, alerts, 5);

    expect(results).toHaveLength(1);
    expect(results[0].alert.id).toBe("alt-1");
  });

  test("handles API errors gracefully", async () => {
    const alerts = [
      createMockAlert({ id: "alt-1" }),
      createMockAlert({ id: "alt-2" }),
    ];

    globalThis.fetch = mock(() => Promise.reject(new Error("API error")));

    const results = await fetchFlightDataFromAPI(env, alerts, 5);

    expect(results).toHaveLength(0);
  });

  test("handles non-ok API responses", async () => {
    const alert = createMockAlert();

    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse({ error: "Bad request" }, 400, false)),
    );

    const results = await fetchFlightDataFromAPI(env, [alert], 5);

    expect(results).toHaveLength(0);
  });

  test("constructs correct API URL with all filters", async () => {
    const alert = createMockAlert({
      filters: {
        version: "v1" as const,
        route: { from: "JFK", to: "LAX" },
        filters: {
          dateFrom: "2025-12-01",
          dateTo: "2025-12-15",
          class: "BUSINESS",
          stops: "NONSTOP",
          airlines: ["UA", "AA"],
          price: 500,
        },
      },
    });

    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse(createMockFlightsApiResponse([]))),
    );

    await fetchFlightDataFromAPI(env, [alert], 5);

    const mockFetch = globalThis.fetch as MockFetch;
    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain("origin=JFK");
    expect(callUrl).toContain("destination=LAX");
    expect(callUrl).toContain("dateFrom=2025-12-01");
    expect(callUrl).toContain("dateTo=2025-12-15");
    expect(callUrl).toContain("seatType=BUSINESS");
    expect(callUrl).toContain("stops=NONSTOP");
    // URL encoding converts comma to %2C
    expect(callUrl).toMatch(/airlines=UA(?:%2C|,)AA/);
    expect(callUrl).toContain("maxPrice=500");
  });

  test("returns empty array for empty input", async () => {
    const results = await fetchFlightDataFromAPI(env, [], 5);
    expect(results).toHaveLength(0);
  });

  test("uses NEXTJS_API_URL from env", async () => {
    const customEnv = createMockEnv({ NEXTJS_API_URL: "https://custom.com" });
    const alert = createMockAlert();

    globalThis.fetch = mock(() =>
      Promise.resolve(mockFetchResponse(createMockFlightsApiResponse([]))),
    );

    await fetchFlightDataFromAPI(customEnv, [alert], 5);

    const mockFetch = globalThis.fetch as MockFetch;
    const callUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(callUrl).toStartWith("https://custom.com/api/flights");
  });
});
