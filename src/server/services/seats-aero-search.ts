import {
  completeSearchRequest,
  createSearchRequest,
  failSearchRequest,
  getAvailabilityTrips,
  getSearchRequest,
  updateSearchRequestProgress,
  upsertAvailabilityTrip,
} from "@/core/seats-aero-cache-db";
import type { SearchResponse } from "@/lib/fli/models/seats-aero";
import { createSeatsAeroClient } from "@/lib/fli/seats-aero/client";
import type { SeatsAeroSearchInput } from "../schemas/seats-aero-search";

/**
 * Service for searching flight availability using seats.aero API with normalized caching
 */

export class SeatsAeroSearchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SeatsAeroSearchError";
  }
}

/**
 * Searches for flight availability using seats.aero API with normalized caching
 *
 * Flow:
 * 1. Check if we have a fresh completed search request
 * 2. If yes, return cached trips from DB
 * 3. If no, fetch from API, store individual trips, track pagination
 * 4. Return trips from DB
 *
 * @param input - Search parameters
 * @returns Search response with availability data
 * @throws {SeatsAeroSearchError} If the search fails
 */
export async function searchSeatsAero(
  input: SeatsAeroSearchInput,
): Promise<SearchResponse> {
  const searchParams = {
    originAirport: input.originAirport,
    destinationAirport: input.destinationAirport,
    searchStartDate: input.startDate,
    searchEndDate: input.endDate,
  };

  try {
    // 1. Check for existing fresh search request
    const existingSearch = await getSearchRequest(searchParams);

    if (existingSearch?.status === "completed" && input.useCache) {
      // Return cached trips from DB
      const trips = await getAvailabilityTrips({
        originAirport: input.originAirport,
        destinationAirport: input.destinationAirport,
        searchStartDate: input.startDate,
        searchEndDate: input.endDate,
      });

      return {
        data: [], // We don't need the Availability structure anymore
        count: trips.length,
        hasMore: false,
        cursor: 0,
      };
    }

    // 2. If search is in progress or failed, we could resume, but for now let's create fresh
    // In production, you might want to handle resuming interrupted searches

    // 3. Create new search request
    const searchRequest =
      existingSearch?.status === "pending"
        ? existingSearch
        : await createSearchRequest({
            ...searchParams,
            ttlMinutes: 60,
          });

    const client = createSeatsAeroClient();

    // 4. Fetch from API with pagination
    let cursor: number | undefined = searchRequest.cursor ?? undefined;
    let totalProcessed = searchRequest.processedCount ?? 0;

    try {
      do {
        const apiResponse = await client.search({
          origin_airport: input.originAirport,
          destination_airport: input.destinationAirport,
          start_date: input.startDate,
          end_date: input.endDate,
          include_trips: true,
          take: 1000,
          only_direct_flights: false,
          include_filtered: false,
          cursor,
        });

        // 5. Parse and store each trip
        for (const availability of apiResponse.data) {
          for (const trip of availability.AvailabilityTrips) {
            await upsertAvailabilityTrip({
              searchRequestId: searchRequest.id,
              trip,
              ttlMinutes: 120, // 2 hours
            });
          }
        }

        totalProcessed += apiResponse.count;

        // 6. Update progress
        await updateSearchRequestProgress({
          id: searchRequest.id,
          cursor: apiResponse.cursor,
          hasMore: apiResponse.hasMore,
          processedCount: totalProcessed,
        });

        // Check if more pages exist
        cursor = apiResponse.hasMore ? apiResponse.cursor : undefined;
      } while (cursor !== undefined);

      // 7. Mark complete
      await completeSearchRequest(searchRequest.id);
    } catch (error) {
      // Mark as failed
      await failSearchRequest(
        searchRequest.id,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }

    // 8. Return trips from DB
    const trips = await getAvailabilityTrips({
      originAirport: input.originAirport,
      destinationAirport: input.destinationAirport,
      searchStartDate: input.startDate,
      searchEndDate: input.endDate,
    });

    return {
      data: [], // We return empty array here, trips are now normalized
      count: trips.length,
      hasMore: false,
      cursor: 0,
    };
  } catch (error) {
    throw new SeatsAeroSearchError(
      error instanceof Error
        ? `Failed to search flights: ${error.message}`
        : "Failed to search flights",
      error,
    );
  }
}
