import {
  createSearchRequest,
  deleteRouteRecords,
  failSearchRequest,
  getAvailabilityTrips,
  getSearchRequest,
} from "@/core/seats-aero.db";
import type { SeatsAeroAvailabilityTrip } from "@/db/schema";
import { env } from "@/env";
import type { SeatsAeroSearchInput } from "../schemas/seats-aero-search";

/**
 * Service for searching flight availability using seats.aero API with workflow-based processing
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
 * Result of seats.aero search operation
 */
export type SeatsAeroSearchResult = {
  status: "pending" | "processing" | "completed" | "failed";
  trips: SeatsAeroAvailabilityTrip[];
  errorMessage?: string;
};

/**
 * Searches for flight availability using seats.aero API with workflow-based processing
 *
 * Flow:
 * 1. Check if we have a search request in DB
 * 2. If completed and useCache: return cached trips
 * 3. If pending/processing: return current status with partial trips
 * 4. If failed: delete records and create new search
 * 5. If not exists: create search request and trigger workflow
 * 6. Return status for frontend polling
 *
 * @param input - Search parameters
 * @returns Search result with status and trips
 * @throws {SeatsAeroSearchError} If the search fails
 */
export async function searchSeatsAero(
  input: SeatsAeroSearchInput,
): Promise<SeatsAeroSearchResult> {
  const searchParams = {
    originAirport: input.originAirport,
    destinationAirport: input.destinationAirport,
    searchStartDate: input.startDate,
    searchEndDate: input.endDate,
  };

  try {
    // 1. Check for existing search request
    const existingSearch = await getSearchRequest(searchParams);

    // 2. If completed and useCache, return trips
    if (existingSearch?.status === "completed" && input.useCache) {
      const trips = await getAvailabilityTrips({
        originAirport: input.originAirport,
        destinationAirport: input.destinationAirport,
        searchStartDate: input.startDate,
        searchEndDate: input.endDate,
      });

      return { status: "completed", trips };
    }

    // 3. If pending or processing, check useCache flag
    if (
      existingSearch?.status === "pending" ||
      existingSearch?.status === "processing"
    ) {
      // If useCache=false, force a refresh by deleting and restarting
      if (!input.useCache) {
        await deleteRouteRecords(input.originAirport, input.destinationAirport);
        // Continue to create new search request below
      } else {
        // Return current status with partial trips
        const trips = await getAvailabilityTrips({
          originAirport: input.originAirport,
          destinationAirport: input.destinationAirport,
          searchStartDate: input.startDate,
          searchEndDate: input.endDate,
        });

        return { status: existingSearch.status, trips };
      }
    }

    // 4. If failed, delete records to allow retry
    if (existingSearch?.status === "failed") {
      await deleteRouteRecords(input.originAirport, input.destinationAirport);
    }

    // 5. Create new search request
    const searchRequest = await createSearchRequest(searchParams);

    // 6. Trigger workflow via worker HTTP endpoint
    const workerUrl = env.WORKER_URL;
    const workerApiKey = env.WORKER_API_KEY;

    try {
      // Add timeout to prevent hanging if worker is unresponsive
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(
          `${workerUrl}/trigger/seats-aero-search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${workerApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(searchParams),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Worker request failed: ${response.status} ${errorText}`,
          );
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Rollback: mark search as failed so it can be retried
      await failSearchRequest(
        searchRequest.id,
        error instanceof Error ? error.message : "Unknown error",
      );
      throw error;
    }

    // 7. Return pending status
    return { status: "pending", trips: [] };
  } catch (error) {
    throw new SeatsAeroSearchError(
      error instanceof Error
        ? `Failed to search flights: ${error.message}`
        : "Failed to search flights",
      error,
    );
  }
}
