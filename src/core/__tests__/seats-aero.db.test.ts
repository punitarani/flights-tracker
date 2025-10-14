import { beforeAll, describe, expect, it } from "bun:test";
import { db } from "@/db/client";
import { seatsAeroAvailabilityTrip, seatsAeroSearchRequest } from "@/db/schema";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";
import {
  completeSearchRequest,
  createSearchRequest,
  deleteRouteRecords,
  failSearchRequest,
  getAvailabilityTrips,
  getSearchRequest,
  updateSearchRequestProgress,
  upsertAvailabilityTrip,
} from "../seats-aero.db";

// These are integration tests that need a real database connection
// They are skipped when running with mocked db (test setup)
const isDbMocked = db.insert?.mock !== undefined;

beforeAll(async () => {
  if (isDbMocked) return;

  await db.delete(seatsAeroAvailabilityTrip);
  await db.delete(seatsAeroSearchRequest);
});

describe("seats-aero.db", () => {
  describe("Search Request Management", () => {
    it.skipIf(isDbMocked)("should create a search request", async () => {
      const request = await createSearchRequest({
        originAirport: "SFO",
        destinationAirport: "JFK",
        searchStartDate: "2025-03-01",
        searchEndDate: "2025-03-10",
      });

      expect(request).toBeDefined();
      expect(request.id).toStartWith("sasr_");
      expect(request.originAirport).toBe("SFO");
      expect(request.destinationAirport).toBe("JFK");
      expect(request.status).toBe("pending");
    });

    it.skipIf(isDbMocked)(
      "should upsert search request on duplicate route/dates",
      async () => {
        const params = {
          originAirport: "LAX",
          destinationAirport: "NRT",
          searchStartDate: "2025-03-15",
          searchEndDate: "2025-03-25",
        };

        // First insert
        const request1 = await createSearchRequest(params);
        expect(request1.status).toBe("pending");

        // Try to insert again with same params - should update existing
        const request2 = await createSearchRequest(params);
        expect(request2.id).toBe(request1.id); // Same ID means it updated
        expect(request2.status).toBe("pending"); // Reset to pending
      },
    );

    it.skipIf(isDbMocked)(
      "should retrieve an existing search request",
      async () => {
        const created = await createSearchRequest({
          originAirport: "LAX",
          destinationAirport: "ORD",
          searchStartDate: "2025-04-01",
          searchEndDate: "2025-04-10",
        });

        const retrieved = await getSearchRequest({
          originAirport: "LAX",
          destinationAirport: "ORD",
          searchStartDate: "2025-04-01",
          searchEndDate: "2025-04-10",
        });

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
      },
    );

    it.skipIf(isDbMocked)("should update search request progress", async () => {
      const request = await createSearchRequest({
        originAirport: "DFW",
        destinationAirport: "ATL",
        searchStartDate: "2025-05-01",
        searchEndDate: "2025-05-10",
      });

      await updateSearchRequestProgress({
        id: request.id,
        cursor: 100,
        hasMore: true,
        processedCount: 50,
      });

      const updated = await getSearchRequest({
        originAirport: "DFW",
        destinationAirport: "ATL",
        searchStartDate: "2025-05-01",
        searchEndDate: "2025-05-10",
      });

      expect(updated?.status).toBe("processing");
      expect(updated?.cursor).toBe(100);
      expect(updated?.hasMore).toBe(true);
      expect(updated?.processedCount).toBe(50);
    });

    it.skipIf(isDbMocked)(
      "should mark search request as completed",
      async () => {
        const request = await createSearchRequest({
          originAirport: "SEA",
          destinationAirport: "BOS",
          searchStartDate: "2025-06-01",
          searchEndDate: "2025-06-10",
        });

        await completeSearchRequest(request.id);

        const completed = await getSearchRequest({
          originAirport: "SEA",
          destinationAirport: "BOS",
          searchStartDate: "2025-06-01",
          searchEndDate: "2025-06-10",
        });

        expect(completed?.status).toBe("completed");
        expect(completed?.completedAt).toBeDefined();
        expect(completed?.hasMore).toBe(false);
      },
    );

    it.skipIf(isDbMocked)("should mark search request as failed", async () => {
      const request = await createSearchRequest({
        originAirport: "PHX",
        destinationAirport: "DEN",
        searchStartDate: "2025-07-01",
        searchEndDate: "2025-07-10",
      });

      await failSearchRequest(request.id, "API timeout");

      const failed = await getSearchRequest({
        originAirport: "PHX",
        destinationAirport: "DEN",
        searchStartDate: "2025-07-01",
        searchEndDate: "2025-07-10",
      });

      expect(failed?.status).toBe("failed");
      expect(failed?.errorMessage).toBe("API timeout");
      expect(failed?.completedAt).toBeDefined();
    });
  });

  describe("Availability Trip Management", () => {
    it.skipIf(isDbMocked)("should upsert an availability trip", async () => {
      const searchRequest = await createSearchRequest({
        originAirport: "SFO",
        destinationAirport: "LAX",
        searchStartDate: "2025-08-01",
        searchEndDate: "2025-08-10",
      });

      const mockTrip: AvailabilityTrip = {
        ID: "trip-123",
        RouteID: "route-456",
        AvailabilityID: "avail-789",
        OriginAirport: "SFO",
        DestinationAirport: "LAX",
        DepartsAt: "2025-08-05T10:00:00Z",
        ArrivesAt: "2025-08-05T12:30:00Z",
        FlightNumbers: "UA 123",
        Carriers: "United Airlines",
        Aircraft: ["Boeing 737"],
        TotalDuration: 150,
        Stops: 0,
        TotalSegmentDistance: 337,
        Cabin: "economy",
        MileageCost: 12500,
        RemainingSeats: 4,
        TotalTaxes: 25.5,
        TaxesCurrency: "USD",
        TaxesCurrencySymbol: "$",
        Source: "United",
        CreatedAt: "2025-01-01T00:00:00Z",
        UpdatedAt: "2025-01-01T00:00:00Z",
      };

      const trip = await upsertAvailabilityTrip({
        searchRequestId: searchRequest.id,
        trip: mockTrip,
      });

      expect(trip).toBeDefined();
      expect(trip.id).toStartWith("saat_");
      expect(trip.apiTripId).toBe("trip-123");
      expect(trip.originAirport).toBe("SFO");
      expect(trip.destinationAirport).toBe("LAX");
      expect(trip.mileageCost).toBe(12500);
      expect(trip.cabinClass).toBe("economy");
    });

    it.skipIf(isDbMocked)(
      "should update existing trip on conflict",
      async () => {
        const searchRequest = await createSearchRequest({
          originAirport: "JFK",
          destinationAirport: "SFO",
          searchStartDate: "2025-09-01",
          searchEndDate: "2025-09-10",
        });

        const mockTrip: AvailabilityTrip = {
          ID: "trip-unique-456",
          RouteID: "route-789",
          AvailabilityID: "avail-012",
          OriginAirport: "JFK",
          DestinationAirport: "SFO",
          DepartsAt: "2025-09-05T14:00:00Z",
          ArrivesAt: "2025-09-05T17:30:00Z",
          FlightNumbers: "DL 456",
          Carriers: "Delta Air Lines",
          Aircraft: ["Airbus A320"],
          TotalDuration: 210,
          Stops: 0,
          TotalSegmentDistance: 2586,
          Cabin: "business",
          MileageCost: 50000,
          RemainingSeats: 2,
          TotalTaxes: 75.0,
          TaxesCurrency: "USD",
          TaxesCurrencySymbol: "$",
          Source: "Delta",
          CreatedAt: "2025-01-01T00:00:00Z",
          UpdatedAt: "2025-01-01T00:00:00Z",
        };

        // First insert
        const trip1 = await upsertAvailabilityTrip({
          searchRequestId: searchRequest.id,
          trip: mockTrip,
        });

        // Update with new remaining seats
        const updatedMockTrip = { ...mockTrip, RemainingSeats: 1 };
        const trip2 = await upsertAvailabilityTrip({
          searchRequestId: searchRequest.id,
          trip: updatedMockTrip,
        });

        expect(trip1.id).toBe(trip2.id);
        expect(trip2.remainingSeats).toBe(1);
      },
    );

    it.skipIf(isDbMocked)(
      "should get availability trips with filters",
      async () => {
        const searchRequest = await createSearchRequest({
          originAirport: "ORD",
          destinationAirport: "MIA",
          searchStartDate: "2025-10-01",
          searchEndDate: "2025-10-10",
        });

        // Create multiple trips
        const mockTrips: AvailabilityTrip[] = [
          {
            ID: "trip-filter-1",
            RouteID: "route-1",
            AvailabilityID: "avail-1",
            OriginAirport: "ORD",
            DestinationAirport: "MIA",
            DepartsAt: "2025-10-05T08:00:00Z",
            ArrivesAt: "2025-10-05T12:00:00Z",
            FlightNumbers: "AA 100",
            Carriers: "American Airlines",
            Aircraft: null,
            TotalDuration: 240,
            Stops: 0,
            TotalSegmentDistance: 1197,
            Cabin: "economy",
            MileageCost: 15000,
            RemainingSeats: 5,
            TotalTaxes: 30.0,
            TaxesCurrency: "USD",
            TaxesCurrencySymbol: "$",
            Source: "American",
            CreatedAt: "2025-01-01T00:00:00Z",
            UpdatedAt: "2025-01-01T00:00:00Z",
          },
          {
            ID: "trip-filter-2",
            RouteID: "route-2",
            AvailabilityID: "avail-2",
            OriginAirport: "ORD",
            DestinationAirport: "MIA",
            DepartsAt: "2025-10-06T10:00:00Z",
            ArrivesAt: "2025-10-06T14:00:00Z",
            FlightNumbers: "AA 200",
            Carriers: "American Airlines",
            Aircraft: null,
            TotalDuration: 240,
            Stops: 0,
            TotalSegmentDistance: 1197,
            Cabin: "business",
            MileageCost: 40000,
            RemainingSeats: 2,
            TotalTaxes: 50.0,
            TaxesCurrency: "USD",
            TaxesCurrencySymbol: "$",
            Source: "American",
            CreatedAt: "2025-01-01T00:00:00Z",
            UpdatedAt: "2025-01-01T00:00:00Z",
          },
        ];

        for (const trip of mockTrips) {
          await upsertAvailabilityTrip({
            searchRequestId: searchRequest.id,
            trip,
          });
        }

        // Get all trips
        const allTrips = await getAvailabilityTrips({
          originAirport: "ORD",
          destinationAirport: "MIA",
          searchStartDate: "2025-10-01",
          searchEndDate: "2025-10-10",
        });

        expect(allTrips.length).toBeGreaterThanOrEqual(2);

        // Filter by cabin class
        const economyTrips = await getAvailabilityTrips({
          originAirport: "ORD",
          destinationAirport: "MIA",
          searchStartDate: "2025-10-01",
          searchEndDate: "2025-10-10",
          cabinClass: "economy",
        });

        expect(economyTrips.length).toBeGreaterThanOrEqual(1);
        expect(economyTrips.every((t) => t.cabinClass === "economy")).toBe(
          true,
        );

        // Filter by specific date
        const dateTrips = await getAvailabilityTrips({
          originAirport: "ORD",
          destinationAirport: "MIA",
          travelDate: "2025-10-05",
        });

        expect(dateTrips.length).toBeGreaterThanOrEqual(1);
        expect(dateTrips.every((t) => t.travelDate === "2025-10-05")).toBe(
          true,
        );
      },
    );
  });

  describe("Cleanup Operations", () => {
    it.skipIf(isDbMocked)("should delete route records", async () => {
      await createSearchRequest({
        originAirport: "DEL",
        destinationAirport: "RTE",
        searchStartDate: "2025-12-01",
        searchEndDate: "2025-12-10",
      });

      const { searchRequests, trips } = await deleteRouteRecords("DEL", "RTE");

      expect(searchRequests).toBeGreaterThanOrEqual(1);
      expect(trips).toBeGreaterThanOrEqual(0);

      // Verify deletion
      const remaining = await getSearchRequest({
        originAirport: "DEL",
        destinationAirport: "RTE",
        searchStartDate: "2025-12-01",
        searchEndDate: "2025-12-10",
      });

      expect(remaining).toBeNull();
    });
  });
});
