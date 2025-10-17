/**
 * Adapter for seats-aero.db to work in Cloudflare Worker environment
 * Provides optimized database operations with proper error handling
 */

import { and, eq, sql } from "drizzle-orm";
import type {
  SearchRequestParams,
  UpdateSearchRequestProgressInput,
} from "@/core/seats-aero.db";
import {
  type SeatsAeroSearchRequest,
  seatsAeroAvailabilityTrip,
  seatsAeroSearchRequest,
} from "@/db/schema";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";
import { parseFlightNumbers } from "@/lib/fli/models/seats-aero";
import { getWorkerDb } from "../db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Gets an existing search request if it exists
 */
export async function getSearchRequest(
  env: WorkerEnv,
  params: SearchRequestParams,
): Promise<SeatsAeroSearchRequest | null> {
  const db = getWorkerDb(env);

  const result = await db
    .select()
    .from(seatsAeroSearchRequest)
    .where(
      and(
        eq(
          seatsAeroSearchRequest.originAirport,
          params.originAirport.toUpperCase(),
        ),
        eq(
          seatsAeroSearchRequest.destinationAirport,
          params.destinationAirport.toUpperCase(),
        ),
        eq(seatsAeroSearchRequest.searchStartDate, params.searchStartDate),
        eq(seatsAeroSearchRequest.searchEndDate, params.searchEndDate),
      ),
    )
    .orderBy(seatsAeroSearchRequest.createdAt)
    .limit(1);

  return result[0] || null;
}

/**
 * Updates search request progress during pagination
 */
export async function updateSearchRequestProgress(
  env: WorkerEnv,
  input: UpdateSearchRequestProgressInput,
): Promise<void> {
  const db = getWorkerDb(env);

  const updates: Partial<SeatsAeroSearchRequest> = {
    status: "processing",
  };

  if (input.cursor !== undefined) {
    updates.cursor = input.cursor;
  }
  if (input.hasMore !== undefined) {
    updates.hasMore = input.hasMore;
  }
  if (input.processedCount !== undefined) {
    updates.processedCount = input.processedCount;
  }

  await db
    .update(seatsAeroSearchRequest)
    .set(updates)
    .where(eq(seatsAeroSearchRequest.id, input.id));
}

/**
 * Marks a search request as completed
 */
export async function completeSearchRequest(
  env: WorkerEnv,
  id: string,
): Promise<void> {
  const db = getWorkerDb(env);

  await db
    .update(seatsAeroSearchRequest)
    .set({
      status: "completed",
      completedAt: new Date().toISOString(),
      hasMore: false,
    })
    .where(eq(seatsAeroSearchRequest.id, id));
}

/**
 * Marks a search request as failed
 */
export async function failSearchRequest(
  env: WorkerEnv,
  id: string,
  errorMessage: string,
): Promise<void> {
  const db = getWorkerDb(env);

  await db
    .update(seatsAeroSearchRequest)
    .set({
      status: "failed",
      errorMessage,
      completedAt: new Date().toISOString(),
    })
    .where(eq(seatsAeroSearchRequest.id, id));
}

/**
 * Maps seats.aero cabin class strings to our database enum values
 */
const cabinClassMap: Record<
  string,
  "economy" | "business" | "first" | "premium_economy"
> = {
  economy: "economy",
  business: "business",
  first: "first",
  premium_economy: "premium_economy",
  // Handle variations
  "premium economy": "premium_economy",
  economyplus: "premium_economy",
  "economy plus": "premium_economy",
};

type UpsertAvailabilityTripsInput = {
  searchRequestId: string;
  trips: AvailabilityTrip[];
};

/**
 * Safely transforms an AvailabilityTrip to database format
 * Handles missing fields and type conversions with proper defaults
 */
function transformTripToDbFormat(
  trip: AvailabilityTrip,
  searchRequestId: string,
) {
  try {
    // Extract travel date from departure time
    const travelDate = trip.DepartsAt.split("T")[0];
    if (!travelDate) {
      throw new Error(`Invalid DepartsAt format: ${trip.DepartsAt}`);
    }

    // Parse and validate cabin class
    const cabinKey = trip.Cabin.toLowerCase().trim();
    const cabinClass = cabinClassMap[cabinKey] || "economy";

    return {
      searchRequestId,
      apiTripId: trip.ID,
      apiRouteId: trip.RouteID,
      apiAvailabilityId: trip.AvailabilityID,
      originAirport: trip.OriginAirport.toUpperCase(),
      destinationAirport: trip.DestinationAirport.toUpperCase(),
      travelDate,
      flightNumbers: parseFlightNumbers(trip.FlightNumbers),
      carriers: trip.Carriers,
      aircraftTypes: trip.Aircraft || null,
      departureTime: trip.DepartsAt,
      arrivalTime: trip.ArrivesAt,
      durationMinutes: trip.TotalDuration,
      stops: trip.Stops,
      totalDistanceMiles: trip.TotalSegmentDistance,
      cabinClass,
      mileageCost: trip.MileageCost,
      remainingSeats: trip.RemainingSeats,
      totalTaxes: trip.TotalTaxes.toString(),
      taxesCurrency: trip.TaxesCurrency || null,
      taxesCurrencySymbol: trip.TaxesCurrencySymbol || null,
      source: trip.Source,
      apiCreatedAt: trip.CreatedAt,
      apiUpdatedAt: trip.UpdatedAt,
      rawData: trip,
    };
  } catch (error) {
    workerLogger.error("Failed to transform trip to DB format", {
      tripId: trip.ID,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Bulk upserts availability trips with optimized batch processing.
 * Uses smaller batches to avoid query size limits and better error isolation.
 */
export async function upsertAvailabilityTrips(
  env: WorkerEnv,
  input: UpsertAvailabilityTripsInput,
): Promise<void> {
  if (input.trips.length === 0) {
    return;
  }

  const db = getWorkerDb(env);
  const batchSize = 10; // Reduced from 25 to avoid query size limits
  const batches = [];

  // Split into smaller batches
  for (let i = 0; i < input.trips.length; i += batchSize) {
    batches.push(input.trips.slice(i, i + batchSize));
  }

  workerLogger.info("Starting batch upsert of availability trips", {
    totalTrips: input.trips.length,
    batches: batches.length,
    batchSize,
    searchRequestId: input.searchRequestId,
  });

  // Process batches sequentially to avoid overwhelming the database
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      // Transform all trips in this batch
      const values = batch.map((trip) =>
        transformTripToDbFormat(trip, input.searchRequestId),
      );

      // Bulk upsert with proper SQL EXCLUDED reference
      await db
        .insert(seatsAeroAvailabilityTrip)
        .values(values)
        .onConflictDoUpdate({
          target: seatsAeroAvailabilityTrip.apiTripId,
          set: {
            searchRequestId: sql.raw("EXCLUDED.search_request_id"),
            apiRouteId: sql.raw("EXCLUDED.api_route_id"),
            apiAvailabilityId: sql.raw("EXCLUDED.api_availability_id"),
            originAirport: sql.raw("EXCLUDED.origin_airport"),
            destinationAirport: sql.raw("EXCLUDED.destination_airport"),
            travelDate: sql.raw("EXCLUDED.travel_date"),
            flightNumbers: sql.raw("EXCLUDED.flight_numbers"),
            carriers: sql.raw("EXCLUDED.carriers"),
            aircraftTypes: sql.raw("EXCLUDED.aircraft_types"),
            departureTime: sql.raw("EXCLUDED.departure_time"),
            arrivalTime: sql.raw("EXCLUDED.arrival_time"),
            durationMinutes: sql.raw("EXCLUDED.duration_minutes"),
            stops: sql.raw("EXCLUDED.stops"),
            totalDistanceMiles: sql.raw("EXCLUDED.total_distance_miles"),
            cabinClass: sql.raw("EXCLUDED.cabin_class"),
            mileageCost: sql.raw("EXCLUDED.mileage_cost"),
            remainingSeats: sql.raw("EXCLUDED.remaining_seats"),
            totalTaxes: sql.raw("EXCLUDED.total_taxes"),
            taxesCurrency: sql.raw("EXCLUDED.taxes_currency"),
            taxesCurrencySymbol: sql.raw("EXCLUDED.taxes_currency_symbol"),
            source: sql.raw("EXCLUDED.source"),
            apiCreatedAt: sql.raw("EXCLUDED.api_created_at"),
            apiUpdatedAt: sql.raw("EXCLUDED.api_updated_at"),
            rawData: sql.raw("EXCLUDED.raw_data"),
          },
        });

      workerLogger.debug("Batch upsert successful", {
        batchIndex: batchIndex + 1,
        batchSize: batch.length,
      });
    } catch (error) {
      workerLogger.error("Batch upsert failed", {
        batchIndex: batchIndex + 1,
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
        searchRequestId: input.searchRequestId,
      });

      captureException(error, {
        context: "upsertAvailabilityTrips",
        batchIndex: batchIndex + 1,
        batchSize: batch.length,
        searchRequestId: input.searchRequestId,
      });

      throw error; // Re-throw to allow workflow step retry
    }
  }

  workerLogger.info("Completed batch upsert of availability trips", {
    totalTrips: input.trips.length,
    batches: batches.length,
    searchRequestId: input.searchRequestId,
  });
}
