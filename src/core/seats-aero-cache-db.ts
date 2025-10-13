import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  type SeatsAeroAvailabilityTrip,
  type SeatsAeroSearchRequest,
  seatsAeroAvailabilityTrip,
  seatsAeroSearchRequest,
} from "@/db/schema";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";

/**
 * Database operations for seats.aero normalized cache
 * Tracks search requests and individual flight availability records
 */

export type SearchRequestParams = {
  originAirport: string;
  destinationAirport: string;
  searchStartDate: string;
  searchEndDate: string;
};

export type CreateSearchRequestInput = SearchRequestParams & {
  ttlMinutes?: number;
};

export type UpdateSearchRequestProgressInput = {
  id: string;
  cursor?: number | null;
  hasMore?: boolean;
  processedCount?: number;
};

export type UpsertAvailabilityTripInput = {
  searchRequestId: string;
  trip: AvailabilityTrip;
  ttlMinutes?: number;
};

export type GetAvailabilityTripsParams = {
  originAirport: string;
  destinationAirport: string;
  travelDate?: string;
  searchStartDate?: string;
  searchEndDate?: string;
  cabinClass?: "economy" | "business" | "first" | "premium_economy";
  source?: string;
};

export type GetAvailabilityByDayParams = {
  originAirport: string;
  destinationAirport: string;
  searchStartDate: string;
  searchEndDate: string;
  cabinClass?: "economy" | "business" | "first" | "premium_economy";
};

export type AvailabilityByDay = {
  travelDate: string;
  totalFlights: number;
  economyCount: number;
  businessCount: number;
  firstCount: number;
  premiumEconomyCount: number;
  economyMinMileage: number | null;
  businessMinMileage: number | null;
  firstMinMileage: number | null;
  premiumEconomyMinMileage: number | null;
  hasDirectFlights: boolean;
};

/**
 * Creates a new search request record or updates if one exists
 * Uses UPSERT to handle expired records with same route/dates
 * @param input - Search request parameters
 * @returns The created or updated search request
 */
export async function createSearchRequest(
  input: CreateSearchRequestInput,
): Promise<SeatsAeroSearchRequest> {
  const now = new Date();
  const ttl = input.ttlMinutes ?? 60;
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);

  const values = {
    originAirport: input.originAirport.toUpperCase(),
    destinationAirport: input.destinationAirport.toUpperCase(),
    searchStartDate: input.searchStartDate,
    searchEndDate: input.searchEndDate,
    status: "pending" as const,
    cursor: null,
    hasMore: null,
    totalCount: null,
    processedCount: null,
    errorMessage: null,
    completedAt: null,
    expiresAt: expiresAt.toISOString(),
  };

  const result = await db
    .insert(seatsAeroSearchRequest)
    .values(values)
    .onConflictDoUpdate({
      target: [
        seatsAeroSearchRequest.originAirport,
        seatsAeroSearchRequest.destinationAirport,
        seatsAeroSearchRequest.searchStartDate,
        seatsAeroSearchRequest.searchEndDate,
      ],
      set: values,
    })
    .returning();

  return result[0];
}

/**
 * Gets an existing search request if it exists and is not expired
 * @param params - Search parameters to match
 * @returns Search request if found, null otherwise
 */
export async function getSearchRequest(
  params: SearchRequestParams,
): Promise<SeatsAeroSearchRequest | null> {
  const now = new Date().toISOString();

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
        gte(seatsAeroSearchRequest.expiresAt, now),
      ),
    )
    .orderBy(seatsAeroSearchRequest.createdAt)
    .limit(1);

  return result[0] || null;
}

/**
 * Updates search request progress during pagination
 * @param input - Update parameters
 */
export async function updateSearchRequestProgress(
  input: UpdateSearchRequestProgressInput,
): Promise<void> {
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
 * @param id - Search request ID
 */
export async function completeSearchRequest(id: string): Promise<void> {
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
 * @param id - Search request ID
 * @param errorMessage - Error description
 */
export async function failSearchRequest(
  id: string,
  errorMessage: string,
): Promise<void> {
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
 * @param input - Trip data
 * @returns The upserted trip
 */
export async function upsertAvailabilityTrip(
  input: UpsertAvailabilityTripInput,
): Promise<SeatsAeroAvailabilityTrip> {
  const now = new Date();
  const ttl = input.ttlMinutes ?? 120; // 2 hours default
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);

  const trip = input.trip;

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
    flightNumbers: trip.FlightNumbers,
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
    expiresAt: expiresAt.toISOString(),
    rawData: trip,
  };

  // Upsert using ON CONFLICT
  const result = await db
    .insert(seatsAeroAvailabilityTrip)
    .values(values)
    .onConflictDoUpdate({
      target: seatsAeroAvailabilityTrip.apiTripId,
      set: {
        ...values,
        createdAt: undefined, // Don't update createdAt on conflict
      },
    })
    .returning();

  return result[0];
}

/**
 * Gets aggregated availability by day with counts and min mileage per cabin class
 * Uses SQL GROUP BY for optimal performance
 * @param params - Query parameters
 * @returns Array of daily availability aggregates
 */
export async function getAvailabilityByDay(
  params: GetAvailabilityByDayParams,
): Promise<AvailabilityByDay[]> {
  const now = new Date().toISOString();

  // Build WHERE conditions
  const conditions = [
    sql`${seatsAeroAvailabilityTrip.originAirport} = ${params.originAirport.toUpperCase()}`,
    sql`${seatsAeroAvailabilityTrip.destinationAirport} = ${params.destinationAirport.toUpperCase()}`,
    sql`${seatsAeroAvailabilityTrip.travelDate} >= ${params.searchStartDate}`,
    sql`${seatsAeroAvailabilityTrip.travelDate} <= ${params.searchEndDate}`,
    sql`${seatsAeroAvailabilityTrip.expiresAt} >= ${now}`,
  ];

  // Add optional cabin class filter
  if (params.cabinClass) {
    conditions.push(
      sql`${seatsAeroAvailabilityTrip.cabinClass} = ${params.cabinClass}`,
    );
  }

  const whereClause = sql.join(conditions, sql.raw(" AND "));

  // SQL query with aggregation
  const results = await db.execute<AvailabilityByDay>(sql`
    SELECT
      ${seatsAeroAvailabilityTrip.travelDate} as "travelDate",
      COUNT(*)::int as "totalFlights",
      COUNT(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'economy' THEN 1 END)::int as "economyCount",
      COUNT(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'business' THEN 1 END)::int as "businessCount",
      COUNT(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'first' THEN 1 END)::int as "firstCount",
      COUNT(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'premium_economy' THEN 1 END)::int as "premiumEconomyCount",
      MIN(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'economy' THEN ${seatsAeroAvailabilityTrip.mileageCost} END)::int as "economyMinMileage",
      MIN(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'business' THEN ${seatsAeroAvailabilityTrip.mileageCost} END)::int as "businessMinMileage",
      MIN(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'first' THEN ${seatsAeroAvailabilityTrip.mileageCost} END)::int as "firstMinMileage",
      MIN(CASE WHEN ${seatsAeroAvailabilityTrip.cabinClass} = 'premium_economy' THEN ${seatsAeroAvailabilityTrip.mileageCost} END)::int as "premiumEconomyMinMileage",
      BOOL_OR(${seatsAeroAvailabilityTrip.stops} = 0) as "hasDirectFlights"
    FROM ${seatsAeroAvailabilityTrip}
    WHERE ${whereClause}
    GROUP BY ${seatsAeroAvailabilityTrip.travelDate}
    ORDER BY ${seatsAeroAvailabilityTrip.travelDate} ASC
  `);

  return results as AvailabilityByDay[];
}

/**
 * Gets availability trips with optional filters
 * @param params - Query parameters
 * @returns Array of availability trips
 */
export async function getAvailabilityTrips(
  params: GetAvailabilityTripsParams,
): Promise<SeatsAeroAvailabilityTrip[]> {
  const now = new Date().toISOString();

  const conditions = [
    eq(
      seatsAeroAvailabilityTrip.originAirport,
      params.originAirport.toUpperCase(),
    ),
    eq(
      seatsAeroAvailabilityTrip.destinationAirport,
      params.destinationAirport.toUpperCase(),
    ),
    gte(seatsAeroAvailabilityTrip.expiresAt, now),
  ];

  // Add optional filters
  if (params.travelDate) {
    conditions.push(
      eq(seatsAeroAvailabilityTrip.travelDate, params.travelDate),
    );
  }

  if (params.searchStartDate && params.searchEndDate) {
    conditions.push(
      gte(seatsAeroAvailabilityTrip.travelDate, params.searchStartDate),
    );
    conditions.push(
      lte(seatsAeroAvailabilityTrip.travelDate, params.searchEndDate),
    );
  }

  if (params.cabinClass) {
    conditions.push(
      eq(seatsAeroAvailabilityTrip.cabinClass, params.cabinClass),
    );
  }

  if (params.source) {
    conditions.push(eq(seatsAeroAvailabilityTrip.source, params.source));
  }

  const results = await db
    .select()
    .from(seatsAeroAvailabilityTrip)
    .where(and(...conditions))
    .orderBy(
      seatsAeroAvailabilityTrip.travelDate,
      seatsAeroAvailabilityTrip.departureTime,
    );

  return results;
}

/**
 * Deletes expired search requests and trips
 * @returns Number of records deleted
 */
export async function deleteExpiredRecords(): Promise<{
  searchRequests: number;
  trips: number;
}> {
  const now = new Date().toISOString();

  const expiredRequests = await db
    .delete(seatsAeroSearchRequest)
    .where(lte(seatsAeroSearchRequest.expiresAt, now))
    .returning();

  const expiredTrips = await db
    .delete(seatsAeroAvailabilityTrip)
    .where(lte(seatsAeroAvailabilityTrip.expiresAt, now))
    .returning();

  return {
    searchRequests: expiredRequests.length,
    trips: expiredTrips.length,
  };
}

/**
 * Deletes all records for a specific route
 * @param originAirport - Origin airport IATA code
 * @param destinationAirport - Destination airport IATA code
 * @returns Number of records deleted
 */
export async function deleteRouteRecords(
  originAirport: string,
  destinationAirport: string,
): Promise<{ searchRequests: number; trips: number }> {
  const requests = await db
    .delete(seatsAeroSearchRequest)
    .where(
      and(
        eq(seatsAeroSearchRequest.originAirport, originAirport.toUpperCase()),
        eq(
          seatsAeroSearchRequest.destinationAirport,
          destinationAirport.toUpperCase(),
        ),
      ),
    )
    .returning();

  const trips = await db
    .delete(seatsAeroAvailabilityTrip)
    .where(
      and(
        eq(
          seatsAeroAvailabilityTrip.originAirport,
          originAirport.toUpperCase(),
        ),
        eq(
          seatsAeroAvailabilityTrip.destinationAirport,
          destinationAirport.toUpperCase(),
        ),
      ),
    )
    .returning();

  return {
    searchRequests: requests.length,
    trips: trips.length,
  };
}
