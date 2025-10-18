import { ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { airport } from "@/db/schema";

/**
 * Airport data with extracted coordinates from PostGIS geometry
 */
export interface AirportWithCoordinates {
  id: string;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

/**
 * Search airports in database with PostGIS coordinate extraction
 * Searches across: IATA code, ICAO code, name, city, country
 *
 * @param query - Search term (e.g., "NYC", "San Francisco", "SFO")
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of airports with lat/lon coordinates
 */
export async function searchAirportsDB(
  query: string,
  limit = 10,
): Promise<AirportWithCoordinates[]> {
  const normalizedQuery = query.trim().toUpperCase();

  if (!normalizedQuery) {
    return [];
  }

  // CRITICAL FIX: Try exact IATA match first (most common case)
  if (normalizedQuery.length === 3) {
    const exactMatch = await db
      .select({
        id: airport.id,
        iata: airport.iata,
        icao: airport.icao,
        name: airport.name,
        city: airport.city,
        country: airport.country,
        latitude: sql<number>`ST_Y(${airport.location})::float`,
        longitude: sql<number>`ST_X(${airport.location})::float`,
      })
      .from(airport)
      .where(sql`UPPER(${airport.iata}) = ${normalizedQuery}`)
      .limit(1);

    if (exactMatch.length > 0) {
      console.log("✅ Found exact IATA match:", exactMatch[0].iata);
      return exactMatch;
    }
  }

  // Fallback: Fuzzy search across all fields
  const results = await db
    .select({
      id: airport.id,
      iata: airport.iata,
      icao: airport.icao,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      latitude: sql<number>`ST_Y(${airport.location})::float`,
      longitude: sql<number>`ST_X(${airport.location})::float`,
    })
    .from(airport)
    .where(
      or(
        ilike(airport.iata, `%${normalizedQuery}%`),
        ilike(airport.icao, `%${normalizedQuery}%`),
        ilike(airport.name, `%${normalizedQuery}%`),
        ilike(airport.city, `%${normalizedQuery}%`),
        ilike(airport.country, `%${normalizedQuery}%`),
      ),
    )
    .limit(limit);

  console.log("🔍 Fuzzy search results:", {
    query: normalizedQuery,
    found: results.length,
    samples: results.slice(0, 3).map((r) => r.iata),
  });

  return results;
}

/**
 * Get airport by exact IATA code with coordinates
 *
 * @param iataCode - 3-letter IATA code (case-insensitive)
 * @returns Airport with coordinates or null if not found
 */
export async function getAirportByIataDB(
  iataCode: string,
): Promise<AirportWithCoordinates | null> {
  const results = await db
    .select({
      id: airport.id,
      iata: airport.iata,
      icao: airport.icao,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      latitude: sql<number>`ST_Y(${airport.location})::float`,
      longitude: sql<number>`ST_X(${airport.location})::float`,
    })
    .from(airport)
    .where(ilike(airport.iata, iataCode.trim()))
    .limit(1);

  return results[0] || null;
}

/**
 * Get multiple airports by IATA codes
 *
 * @param iataCodes - Array of IATA codes
 * @returns Array of airports with coordinates
 */
export async function getAirportsByIataDB(
  iataCodes: string[],
): Promise<AirportWithCoordinates[]> {
  if (iataCodes.length === 0) {
    return [];
  }

  const results = await db
    .select({
      id: airport.id,
      iata: airport.iata,
      icao: airport.icao,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      latitude: sql<number>`ST_Y(${airport.location})::float`,
      longitude: sql<number>`ST_X(${airport.location})::float`,
    })
    .from(airport)
    .where(or(...iataCodes.map((code) => ilike(airport.iata, code.trim()))))
    .limit(iataCodes.length);

  return results;
}

/**
 * Calculate distance between two points using Haversine formula
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
