/**
 * Tests for SeatsAeroClient search functionality.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";
import type {
  SearchRequestParams,
  SearchResponse,
} from "../../models/seats-aero";
import { SeatsAeroAPIError, SeatsAeroClient } from "../../seats-aero/client";

// Load mock data from the test file
const mockSearchResponse: SearchResponse = JSON.parse(
  readFileSync("data/seats-aero/sfo-phx-seats-1y.json", "utf-8"),
);

describe("SeatsAeroClient - search", () => {
  let client: SeatsAeroClient;

  beforeEach(() => {
    // Create client with test API key
    client = new SeatsAeroClient({
      apiKey: "test-api-key",
      baseUrl: "https://api.seats.aero",
    });
  });

  it("should successfully search for cached availability", async () => {
    // Mock axios to return test data
    const mockAxiosGet = mock().mockResolvedValue({
      data: mockSearchResponse,
      status: 200,
      statusText: "OK",
    });

    // Mock axios module
    mock.module("axios", () => ({
      default: { get: mockAxiosGet, isAxiosError: mock(() => false) },
    }));

    const params: SearchRequestParams = {
      origin_airport: "SFO",
      destination_airport: "PHX",
      start_date: "2025-10-11",
      end_date: "2025-10-18",
      include_trips: true,
    };

    const result = await client.search(params);

    // Verify axios was called correctly
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining("https://api.seats.aero/search?"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Partner-Authorization": "test-api-key",
          Accept: "application/json",
        }),
      }),
    );

    // Verify URL contains query parameters
    const calledUrl = mockAxiosGet.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("origin_airport=SFO");
    expect(calledUrl).toContain("destination_airport=PHX");
    expect(calledUrl).toContain("start_date=2025-10-11");
    expect(calledUrl).toContain("end_date=2025-10-18");
    expect(calledUrl).toContain("include_trips=true");

    // Verify response structure
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("count");
    expect(result).toHaveProperty("hasMore");
    expect(result).toHaveProperty("cursor");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("should handle pagination with cursor and skip", async () => {
    // Mock axios
    const mockAxiosGet = mock().mockResolvedValue({
      data: mockSearchResponse,
      status: 200,
      statusText: "OK",
    });

    mock.module("axios", () => ({
      default: { get: mockAxiosGet, isAxiosError: mock(() => false) },
    }));

    const params: SearchRequestParams = {
      origin_airport: "SFO",
      destination_airport: "PHX",
      cursor: 1234567890,
      skip: 500,
    };

    await client.search(params);

    const calledUrl = mockAxiosGet.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("cursor=1234567890");
    expect(calledUrl).toContain("skip=500");
  });

  it("should handle minimal search parameters", async () => {
    // Mock axios
    const mockAxiosGet = mock().mockResolvedValue({
      data: mockSearchResponse,
      status: 200,
      statusText: "OK",
    });

    mock.module("axios", () => ({
      default: { get: mockAxiosGet, isAxiosError: mock(() => false) },
    }));

    const params: SearchRequestParams = {
      origin_airport: "LAX",
      destination_airport: "JFK",
    };

    const result = await client.search(params);

    // Verify default take parameter is applied
    const calledUrl = mockAxiosGet.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("origin_airport=LAX");
    expect(calledUrl).toContain("destination_airport=JFK");
    expect(calledUrl).toContain("take=500"); // default value

    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should handle search with filters", async () => {
    // Mock axios
    const mockAxiosGet = mock().mockResolvedValue({
      data: mockSearchResponse,
      status: 200,
      statusText: "OK",
    });

    mock.module("axios", () => ({
      default: { get: mockAxiosGet, isAxiosError: mock(() => false) },
    }));

    const params: SearchRequestParams = {
      origin_airport: "SFO",
      destination_airport: "NRT",
      start_date: "2025-12-01",
      end_date: "2025-12-15",
      sources: "united,aeroplan",
      cabins: "business,first",
      only_direct_flights: true,
    };

    await client.search(params);

    const calledUrl = mockAxiosGet.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("sources=united%2Caeroplan");
    expect(calledUrl).toContain("cabins=business%2Cfirst");
    expect(calledUrl).toContain("only_direct_flights=true");
  });

  it("should throw SeatsAeroAPIError on HTTP 400 error", async () => {
    const mockAxiosError = {
      response: {
        status: 400,
        statusText: "Bad Request",
      },
      isAxiosError: true,
    };

    mock.module("axios", () => ({
      default: {
        get: mock().mockRejectedValue(mockAxiosError),
        isAxiosError: mock(() => true),
      },
    }));

    const params: SearchRequestParams = {
      origin_airport: "SFO",
      destination_airport: "PHX",
    };

    await expect(client.search(params)).rejects.toThrow(SeatsAeroAPIError);
    await expect(client.search(params)).rejects.toThrow(
      "Search request failed",
    );
  });

  it("should throw SeatsAeroAPIError on HTTP 500 error", async () => {
    const mockAxiosError = {
      response: {
        status: 500,
        statusText: "Internal Server Error",
      },
      isAxiosError: true,
    };

    mock.module("axios", () => ({
      default: {
        get: mock().mockRejectedValue(mockAxiosError),
        isAxiosError: mock(() => true),
      },
    }));

    const params: SearchRequestParams = {
      origin_airport: "SFO",
      destination_airport: "PHX",
    };

    await expect(client.search(params)).rejects.toThrow(SeatsAeroAPIError);
    await expect(client.search(params)).rejects.toThrow(
      "Search request failed",
    );
  });

  it("should validate request parameters - too short airport code", async () => {
    const invalidParams = {
      origin_airport: "SF", // Too short
      destination_airport: "PHX",
    } as SearchRequestParams;

    await expect(client.search(invalidParams)).rejects.toThrow();
  });

  it("should validate request parameters - invalid date format", async () => {
    const invalidParams = {
      origin_airport: "SFO",
      destination_airport: "PHX",
      start_date: "10/11/2025", // Wrong format
    } as SearchRequestParams;

    await expect(client.search(invalidParams)).rejects.toThrow();
  });

  it("should validate response matches schema", async () => {
    // Mock axios
    const mockAxiosGet = mock().mockResolvedValue({
      data: mockSearchResponse,
      status: 200,
      statusText: "OK",
    });

    mock.module("axios", () => ({
      default: { get: mockAxiosGet, isAxiosError: mock(() => false) },
    }));

    const params: SearchRequestParams = {
      origin_airport: "SFO",
      destination_airport: "PHX",
    };

    const result = await client.search(params);

    // Verify the response has all required fields
    expect(result.data).toBeDefined();
    expect(result.count).toBeDefined();
    expect(result.hasMore).toBeDefined();
    expect(result.cursor).toBeDefined();

    // Verify first availability record structure
    const firstAvailability = result.data[0];
    expect(firstAvailability).toBeDefined();
    expect(firstAvailability?.Route).toBeDefined();
    expect(firstAvailability?.Route.OriginAirport).toBe("SFO");
    expect(firstAvailability?.Route.DestinationAirport).toBe("PHX");
    expect(firstAvailability?.AvailabilityTrips).toBeDefined();
    expect(Array.isArray(firstAvailability?.AvailabilityTrips)).toBe(true);
  });
});
