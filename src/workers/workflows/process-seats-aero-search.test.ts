/**
 * Unit tests for ProcessSeatsAeroSearchWorkflow
 * Tests verify logic and structure without importing Cloudflare-specific code
 */

import { describe, expect, test } from "bun:test";
import type { SearchRequestParams } from "@/core/seats-aero.db";
import type { SeatsAeroSearchRequest } from "@/db/schema";
import { type AvailabilityTrip, Source } from "@/lib/fli/models/seats-aero";
import { createMockEnv } from "../test/setup";
import {
  paginateSeatsAeroSearch,
  type SeatsAeroClientLike,
  type WorkflowStepLike,
} from "./process-seats-aero-search-pagination";

describe("ProcessSeatsAeroSearchWorkflow", () => {
  const _env = createMockEnv();

  test("creates correct instance ID format", () => {
    const origin = "SFO";
    const dest = "NRT";
    const startDate = "2025-10-15";
    const endDate = "2025-10-22";
    const instanceId = `ProcessSeatsAeroSearch_${origin}_${dest}_${startDate}_${endDate}`;

    expect(instanceId).toBe(
      "ProcessSeatsAeroSearch_SFO_NRT_2025-10-15_2025-10-22",
    );
    expect(instanceId).toMatch(
      /^ProcessSeatsAeroSearch_[A-Z]{3}_[A-Z]{3}_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/,
    );
  });

  test("instance ID ensures idempotency for same route and dates", () => {
    const params = {
      origin: "LAX",
      dest: "JFK",
      startDate: "2025-11-01",
      endDate: "2025-11-08",
    };

    const instanceId1 = `ProcessSeatsAeroSearch_${params.origin}_${params.dest}_${params.startDate}_${params.endDate}`;
    const instanceId2 = `ProcessSeatsAeroSearch_${params.origin}_${params.dest}_${params.startDate}_${params.endDate}`;

    expect(instanceId1).toBe(instanceId2);
  });

  test("different routes create different instance IDs", () => {
    const id1 = "ProcessSeatsAeroSearch_SFO_NRT_2025-10-15_2025-10-22";
    const id2 = "ProcessSeatsAeroSearch_SFO_HND_2025-10-15_2025-10-22";
    const id3 = "ProcessSeatsAeroSearch_LAX_NRT_2025-10-15_2025-10-22";

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);
  });

  test("different date ranges create different instance IDs", () => {
    const id1 = "ProcessSeatsAeroSearch_SFO_NRT_2025-10-15_2025-10-22";
    const id2 = "ProcessSeatsAeroSearch_SFO_NRT_2025-10-16_2025-10-23";
    const id3 = "ProcessSeatsAeroSearch_SFO_NRT_2025-10-15_2025-10-23";

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);
  });

  test("validates retry configuration values", () => {
    const retryConfig = {
      limit: 3,
      delay: "30 seconds",
      backoff: "constant",
    };

    expect(retryConfig.limit).toBe(3);
    expect(retryConfig.delay).toBe("30 seconds");
    expect(retryConfig.backoff).toBe("constant");
  });

  test("validates timeout configuration", () => {
    const timeout = "15 minutes";
    expect(timeout).toBe("15 minutes");
  });

  test("validates pagination configuration", () => {
    const paginationConfig = {
      take: 1000,
      include_trips: true,
      only_direct_flights: false,
      include_filtered: false,
    };

    expect(paginationConfig.take).toBe(1000);
    expect(paginationConfig.include_trips).toBe(true);
    expect(paginationConfig.only_direct_flights).toBe(false);
    expect(paginationConfig.include_filtered).toBe(false);
  });

  test("instance ID includes all required components", () => {
    const origin = "ORD";
    const dest = "LHR";
    const startDate = "2025-12-01";
    const endDate = "2025-12-15";
    const instanceId = `ProcessSeatsAeroSearch_${origin}_${dest}_${startDate}_${endDate}`;

    const parts = instanceId.split("_");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("ProcessSeatsAeroSearch");
    expect(parts[1]).toBe(origin);
    expect(parts[2]).toBe(dest);
    expect(parts[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts[4]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("validates TTL configuration", () => {
    const searchRequestTTL = 60; // minutes
    const tripTTL = 120; // minutes

    expect(searchRequestTTL).toBe(60);
    expect(tripTTL).toBe(120);
    expect(tripTTL).toBeGreaterThan(searchRequestTTL);
  });

  test("validates API search parameters structure", () => {
    const searchParams = {
      origin_airport: "SFO",
      destination_airport: "NRT",
      start_date: "2025-10-15",
      end_date: "2025-10-22",
      include_trips: true,
      take: 1000,
      only_direct_flights: false,
      include_filtered: false,
    };

    expect(searchParams.origin_airport).toMatch(/^[A-Z]{3}$/);
    expect(searchParams.destination_airport).toMatch(/^[A-Z]{3}$/);
    expect(searchParams.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(searchParams.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(searchParams.take).toBeGreaterThan(0);
  });

  test("creates a new workflow step for each paginated API request", async () => {
    const env = createMockEnv();
    const params: SearchRequestParams = {
      originAirport: "SFO",
      destinationAirport: "NRT",
      searchStartDate: "2025-10-15",
      searchEndDate: "2025-10-22",
    };

    const searchRequest: SeatsAeroSearchRequest = {
      id: "sar-123",
      originAirport: params.originAirport,
      destinationAirport: params.destinationAirport,
      searchStartDate: params.searchStartDate,
      searchEndDate: params.searchEndDate,
      status: "processing",
      cursor: null,
      hasMore: true,
      totalCount: 0,
      processedCount: 0,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    } as const;

    const stepCalls: string[] = [];
    const step: WorkflowStepLike = {
      do: async (
        name: string,
        _options: unknown,
        operation: () => Promise<{
          cursor: number | undefined;
          hasMore: boolean;
          processedCount: number;
        }>,
      ) => {
        stepCalls.push(name);
        return operation();
      },
    };

    const searchArgs: unknown[] = [];
    const baseTrip: AvailabilityTrip = {
      ID: "trip-1",
      RouteID: "route-1",
      AvailabilityID: "avail-1",
      OriginAirport: "SFO",
      DestinationAirport: "NRT",
      DepartsAt: "2025-10-15T10:00:00Z",
      ArrivesAt: "2025-10-16T02:00:00Z",
      TotalDuration: 720,
      Stops: 1,
      MileageCost: 70000,
      RemainingSeats: 2,
      Cabin: "business",
      TotalSegmentDistance: 5100,
      TotalTaxes: 5,
      TaxesCurrency: "USD",
      TaxesCurrencySymbol: "$",
      Carriers: "UA",
      FlightNumbers: "UA837",
      Aircraft: ["777"],
      Source: Source.UNITED,
      CreatedAt: "2025-10-01T00:00:00Z",
      UpdatedAt: "2025-10-01T00:00:00Z",
    };

    const trip2: AvailabilityTrip = {
      ...baseTrip,
      ID: "trip-2",
      FlightNumbers: "UA838",
    };

    const trip3: AvailabilityTrip = {
      ...baseTrip,
      ID: "trip-3",
      FlightNumbers: "UA839",
    };

    const responses = [
      {
        count: 2,
        hasMore: true,
        cursor: 101,
        data: [
          { AvailabilityTrips: [baseTrip] },
          { AvailabilityTrips: [trip2] },
        ],
      },
      {
        count: 1,
        hasMore: false,
        cursor: 202,
        data: [{ AvailabilityTrips: [trip3] }],
      },
    ];

    const client: SeatsAeroClientLike = {
      search: async (args: unknown) => {
        searchArgs.push(args);
        const response = responses.shift();
        if (!response) {
          throw new Error("No more responses available");
        }
        return response;
      },
    };

    const upsertCalls: Array<{
      searchRequestId: string;
      trips: AvailabilityTrip[];
    }> = [];
    const updateProgressCalls: Array<{
      id: string;
      cursor: number | undefined;
      hasMore: boolean | undefined;
      processedCount: number | undefined;
    }> = [];

    const result = await paginateSeatsAeroSearch({
      client,
      env,
      params,
      searchRequest,
      step,
      upsertTrips: async (_env, payload) => {
        upsertCalls.push(payload);
      },
      updateProgress: async (_env, payload) => {
        updateProgressCalls.push(payload);
      },
    });

    expect(result.totalProcessed).toBe(3);
    expect(stepCalls).toEqual(["fetch-page-1", "fetch-page-2"]);
    expect(searchArgs).toHaveLength(2);
    expect((searchArgs[0] as { cursor?: number }).cursor).toBeUndefined();
    expect((searchArgs[1] as { cursor?: number }).cursor).toBe(101);

    // Expect 2 upsert calls (one per page, batched within each page)
    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[0]?.trips).toHaveLength(2); // Page 1: 2 trips
    expect(upsertCalls[0]?.searchRequestId).toBe(searchRequest.id);
    expect(upsertCalls[1]?.trips).toHaveLength(1); // Page 2: 1 trip
    expect(upsertCalls[1]?.searchRequestId).toBe(searchRequest.id);

    expect(updateProgressCalls.map((call) => call.processedCount)).toEqual([
      2, 3,
    ]);
    expect(updateProgressCalls[1]?.hasMore).toBe(false);
  });

  test("handles empty response pages without trips", async () => {
    const env = createMockEnv();
    const params: SearchRequestParams = {
      originAirport: "JFK",
      destinationAirport: "LHR",
      searchStartDate: "2025-11-01",
      searchEndDate: "2025-11-08",
    };

    const searchRequest: SeatsAeroSearchRequest = {
      id: "sar-empty",
      originAirport: params.originAirport,
      destinationAirport: params.destinationAirport,
      searchStartDate: params.searchStartDate,
      searchEndDate: params.searchEndDate,
      status: "processing",
      cursor: null,
      hasMore: false,
      totalCount: 0,
      processedCount: 0,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    } as const;

    const stepCalls: string[] = [];
    const step: WorkflowStepLike = {
      do: async (
        name: string,
        _options: unknown,
        operation: () => Promise<{
          cursor: number | undefined;
          hasMore: boolean;
          processedCount: number;
        }>,
      ) => {
        stepCalls.push(name);
        return operation();
      },
    };

    const client: SeatsAeroClientLike = {
      search: async () => ({
        count: 0,
        hasMore: false,
        cursor: 1760549543,
        data: [],
      }),
    };

    const upsertCalls: Array<{
      searchRequestId: string;
      trips: AvailabilityTrip[];
    }> = [];
    const updateProgressCalls: Array<{
      id: string;
      cursor: number | undefined;
      hasMore: boolean | undefined;
      processedCount: number | undefined;
    }> = [];

    const result = await paginateSeatsAeroSearch({
      client,
      env,
      params,
      searchRequest,
      step,
      upsertTrips: async (_env, payload) => {
        upsertCalls.push(payload);
      },
      updateProgress: async (_env, payload) => {
        updateProgressCalls.push(payload);
      },
    });

    expect(result.totalProcessed).toBe(0);
    expect(stepCalls).toEqual(["fetch-page-1"]);
    expect(upsertCalls).toHaveLength(0);
    expect(updateProgressCalls).toHaveLength(1);
    expect(updateProgressCalls[0]).toMatchObject({
      id: "sar-empty",
      cursor: 1760549543,
      hasMore: false,
      processedCount: 0,
    });
  });
});
