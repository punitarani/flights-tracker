/**
 * Adapter for seats-aero.db to work in Cloudflare Worker environment
 * Wraps DB operations with worker DB instance
 */

import { and, eq } from "drizzle-orm";
import type {
  SearchRequestParams,
  UpdateSearchRequestProgressInput,
  UpsertAvailabilityTripInput,
} from "@/core/seats-aero.db";
import {
  type SeatsAeroAvailabilityTrip,
  type SeatsAeroSearchRequest,
  seatsAeroAvailabilityTrip,
  seatsAeroSearchRequest,
} from "@/db/schema";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";
import { parseFlightNumbers } from "@/lib/fli/models/seats-aero";
import { getWorkerDb } from "../db";
import type { WorkerEnv } from "../env";

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
 * Upserts an availability trip (inserts or updates on conflict)
 */
export async function upsertAvailabilityTrip(
  env: WorkerEnv,
  input: UpsertAvailabilityTripInput,
): Promise<SeatsAeroAvailabilityTrip> {
  const db = getWorkerDb(env);
  const trip: AvailabilityTrip = input.trip;

  // Map cabin class from API enum to our schema
  const cabinClassMap: Record<
    string,
    "economy" | "business" | "first" | "premium_economy"
  > = {
    economy: "economy",
    business: "business",
    first: "first",
    premium_economy: "premium_economy",
  };

  const values = {
    searchRequestId: input.searchRequestId,
    apiTripId: trip.ID,
    apiRouteId: trip.RouteID,
    apiAvailabilityId: trip.AvailabilityID,
    originAirport: trip.OriginAirport.toUpperCase(),
    destinationAirport: trip.DestinationAirport.toUpperCase(),
    travelDate: trip.DepartsAt.split("T")[0], // Extract date from ISO timestamp
    flightNumbers: parseFlightNumbers(trip.FlightNumbers),
    carriers: trip.Carriers,
    aircraftTypes: trip.Aircraft ?? null,
    departureTime: trip.DepartsAt,
    arrivalTime: trip.ArrivesAt,
    durationMinutes: trip.TotalDuration,
    stops: trip.Stops,
    totalDistanceMiles: trip.TotalSegmentDistance,
    cabinClass: cabinClassMap[trip.Cabin] || "economy",
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

  // Upsert using ON CONFLICT
  const result = await db
    .insert(seatsAeroAvailabilityTrip)
    .values(values)
    .onConflictDoUpdate({
      target: seatsAeroAvailabilityTrip.apiTripId,
      set: values,
    })
    .returning();

  return result[0];
}
