/**
 * Adapter for seats-aero.db to work in Cloudflare Worker environment
 * Wraps DB operations with worker DB instance
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
import {
  type AvailabilityTrip,
  AvailabilityTripSchema,
  parseFlightNumbers,
} from "@/lib/fli/models/seats-aero";
import { getWorkerDb } from "../db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";

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

const cabinClassMap: Record<
  string,
  "economy" | "business" | "first" | "premium_economy"
> = {
  economy: "economy",
  business: "business",
  first: "first",
  premium_economy: "premium_economy",
};

type UpsertAvailabilityTripsInput = {
  searchRequestId: string;
  trips: AvailabilityTrip[];
};

/**
 * Safely transforms a trip for database insertion with proper error handling
 */
function transformTripForDb(searchRequestId: string, trip: unknown) {
  // Parse and validate with Zod schema
  const validatedTrip = AvailabilityTripSchema.parse(trip);

  // Extract travel date safely
  const travelDate = validatedTrip.DepartsAt.split("T")[0];

  // Parse flight numbers safely
  const flightNumbers = validatedTrip.FlightNumbers
    ? parseFlightNumbers(validatedTrip.FlightNumbers)
    : [];

  return {
    searchRequestId,
    apiTripId: validatedTrip.ID,
    apiRouteId: validatedTrip.RouteID,
    apiAvailabilityId: validatedTrip.AvailabilityID,
    originAirport: validatedTrip.OriginAirport.toUpperCase(),
    destinationAirport: validatedTrip.DestinationAirport.toUpperCase(),
    travelDate,
    flightNumbers,
    carriers: validatedTrip.Carriers,
    aircraftTypes: validatedTrip.Aircraft ?? null,
    departureTime: validatedTrip.DepartsAt,
    arrivalTime: validatedTrip.ArrivesAt,
    durationMinutes: validatedTrip.TotalDuration,
    stops: validatedTrip.Stops,
    totalDistanceMiles: validatedTrip.TotalSegmentDistance,
    cabinClass: cabinClassMap[validatedTrip.Cabin] || "economy",
    mileageCost: validatedTrip.MileageCost,
    remainingSeats: validatedTrip.RemainingSeats,
    totalTaxes: validatedTrip.TotalTaxes.toString(),
    taxesCurrency: validatedTrip.TaxesCurrency || null,
    taxesCurrencySymbol: validatedTrip.TaxesCurrencySymbol || null,
    source: validatedTrip.Source,
    apiCreatedAt: validatedTrip.CreatedAt,
    apiUpdatedAt: validatedTrip.UpdatedAt,
    rawData: validatedTrip,
  };
}

/**
 * Bulk upserts availability trips to minimize database round-trips.
 */
export async function upsertAvailabilityTrips(
  env: WorkerEnv,
  input: UpsertAvailabilityTripsInput,
): Promise<void> {
  const db = getWorkerDb(env);

  if (input.trips.length === 0) {
    return;
  }

  workerLogger.info("Starting availability trips upsert", {
    searchRequestId: input.searchRequestId,
    totalTrips: input.trips.length,
  });

  // Validate and transform trips using Zod
  const validTrips: ReturnType<typeof transformTripForDb>[] = [];

  for (const trip of input.trips) {
    try {
      const transformedTrip = transformTripForDb(input.searchRequestId, trip);
      validTrips.push(transformedTrip);
    } catch (error) {
      const tripData = trip as Record<string, unknown>;
      workerLogger.warn("Skipping invalid trip", {
        tripId: typeof tripData.ID === "string" ? tripData.ID : "unknown",
        origin:
          typeof tripData.OriginAirport === "string"
            ? tripData.OriginAirport
            : "unknown",
        destination:
          typeof tripData.DestinationAirport === "string"
            ? tripData.DestinationAirport
            : "unknown",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (validTrips.length === 0) {
    workerLogger.warn("No valid trips to insert after validation", {
      searchRequestId: input.searchRequestId,
      originalCount: input.trips.length,
    });
    return;
  }

  workerLogger.info("Validated trips for upsert", {
    searchRequestId: input.searchRequestId,
    validCount: validTrips.length,
    invalidCount: input.trips.length - validTrips.length,
  });

  try {
    await db
      .insert(seatsAeroAvailabilityTrip)
      .values(validTrips)
      .onConflictDoUpdate({
        target: seatsAeroAvailabilityTrip.apiTripId,
        set: {
          searchRequestId: sql`${sql.raw("excluded.search_request_id")}`,
          apiRouteId: sql`${sql.raw("excluded.api_route_id")}`,
          apiAvailabilityId: sql`${sql.raw("excluded.api_availability_id")}`,
          originAirport: sql`${sql.raw("excluded.origin_airport")}`,
          destinationAirport: sql`${sql.raw("excluded.destination_airport")}`,
          travelDate: sql`${sql.raw("excluded.travel_date")}`,
          flightNumbers: sql`${sql.raw("excluded.flight_numbers")}`,
          carriers: sql`${sql.raw("excluded.carriers")}`,
          aircraftTypes: sql`${sql.raw("excluded.aircraft_types")}`,
          departureTime: sql`${sql.raw("excluded.departure_time")}`,
          arrivalTime: sql`${sql.raw("excluded.arrival_time")}`,
          durationMinutes: sql`${sql.raw("excluded.duration_minutes")}`,
          stops: sql`${sql.raw("excluded.stops")}`,
          totalDistanceMiles: sql`${sql.raw("excluded.total_distance_miles")}`,
          cabinClass: sql`${sql.raw("excluded.cabin_class")}`,
          mileageCost: sql`${sql.raw("excluded.mileage_cost")}`,
          remainingSeats: sql`${sql.raw("excluded.remaining_seats")}`,
          totalTaxes: sql`${sql.raw("excluded.total_taxes")}`,
          taxesCurrency: sql`${sql.raw("excluded.taxes_currency")}`,
          taxesCurrencySymbol: sql`${sql.raw("excluded.taxes_currency_symbol")}`,
          source: sql`${sql.raw("excluded.source")}`,
          apiCreatedAt: sql`${sql.raw("excluded.api_created_at")}`,
          apiUpdatedAt: sql`${sql.raw("excluded.api_updated_at")}`,
          rawData: sql`${sql.raw("excluded.raw_data")}`,
        },
      });

    workerLogger.info("Successfully upserted availability trips", {
      searchRequestId: input.searchRequestId,
      upsertedCount: validTrips.length,
    });
  } catch (error) {
    workerLogger.error("Database upsert failed", {
      searchRequestId: input.searchRequestId,
      validTripCount: validTrips.length,
      error: error instanceof Error ? error.message : String(error),
      sampleTrip: validTrips[0]
        ? {
            apiTripId: validTrips[0].apiTripId,
            origin: validTrips[0].originAirport,
            destination: validTrips[0].destinationAirport,
            travelDate: validTrips[0].travelDate,
            totalTaxes: validTrips[0].totalTaxes,
          }
        : null,
    });
    throw error;
  }
}
