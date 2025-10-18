import type { SearchRequestParams } from "@/core/seats-aero.db";
import type { SeatsAeroSearchRequest } from "@/db/schema";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";
import {
  updateSearchRequestProgress,
  upsertAvailabilityTrips,
} from "../adapters/seats-aero.db";
import { getWorkerDb } from "../db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";

type SeatsAeroSearchResponse = {
  count: number;
  hasMore: boolean;
  cursor: number;
  data: Array<{
    AvailabilityTrips: AvailabilityTrip[] | null;
  }>;
};

export interface SeatsAeroClientLike {
  search: (params: {
    // Required parameters
    origin_airport: string;
    destination_airport: string;
    // Date range
    start_date: string;
    end_date: string;
    // Pagination
    cursor?: number;
    take: number;
    order_by?: string;
    skip?: number;
    // Trip details
    include_trips: boolean;
    only_direct_flights: boolean;
    // Filters
    carriers?: string;
    include_filtered: boolean;
    sources?: string;
    minify_trips?: boolean;
    cabins?: string;
  }) => Promise<SeatsAeroSearchResponse>;
}

export interface WorkflowStepLike {
  do<T>(
    name: string,
    options: unknown,
    operation: () => Promise<T>,
  ): Promise<T>;
}

interface PaginationDependencies {
  client: SeatsAeroClientLike;
  env: WorkerEnv;
  params: SearchRequestParams;
  searchRequest: SeatsAeroSearchRequest;
  step: WorkflowStepLike;
  upsertTrips?: typeof upsertAvailabilityTrips;
  updateProgress?: typeof updateSearchRequestProgress;
}

interface PaginationResult {
  totalProcessed: number;
}

export async function paginateSeatsAeroSearch({
  client,
  env,
  params,
  searchRequest,
  step,
  upsertTrips = upsertAvailabilityTrips,
  updateProgress = updateSearchRequestProgress,
}: PaginationDependencies): Promise<PaginationResult> {
  let cursor = searchRequest.cursor ?? undefined;
  let totalProcessed = searchRequest.processedCount ?? 0;
  let pageIndex = 0;

  const stepOptions = {
    retries: {
      limit: 3,
      delay: "30 seconds" as const,
      backoff: "constant" as const,
    },
    timeout: "10 minutes" as const,
  };

  while (true) {
    const previousTotal = totalProcessed;
    const currentCursor = cursor;
    const currentSkip = totalProcessed; // skip = number of records already processed

    const pageResult = await step.do(
      `fetch-page-${pageIndex + 1}`,
      stepOptions,
      async () => {
        // API parameters in documented order with all fields present
        const response = await client.search({
          // Required parameters
          origin_airport: params.originAirport,
          destination_airport: params.destinationAirport,

          // Date range
          start_date: params.searchStartDate,
          end_date: params.searchEndDate,

          // Pagination (cursor must be from first response and remain constant)
          cursor: currentCursor,
          take: 1000,
          order_by: "lowest_mileage", // Order by cheapest mileage cost first
          skip: currentSkip, // Number of results already retrieved

          // Trip details
          include_trips: true,
          only_direct_flights: false,

          // Filters
          carriers: undefined, // No carrier filter
          include_filtered: false, // Exclude dynamically filtered results
          sources: undefined, // No mileage program filter
          minify_trips: undefined, // Full trip details when include_trips=true
          cabins: undefined, // No cabin class filter
        });

        workerLogger.info("Fetched API page", {
          pageIndex,
          count: response.count,
          hasMore: response.hasMore,
          cursor: response.cursor,
          skip: currentSkip,
          searchRequestId: searchRequest.id,
        });

        // Create DB client once for this step to reuse across all batches
        const db = getWorkerDb(env);

        // Stream-process trips in sequential 200-item batches to minimize memory
        // Database handles deduplication via ON CONFLICT on apiTripId
        let batchTrips: AvailabilityTrip[] = [];

        for (const availability of response.data) {
          for (const trip of availability.AvailabilityTrips ?? []) {
            batchTrips.push(trip);

            // When we hit batch size, process and clear
            if (batchTrips.length === 200) {
              await upsertTrips(
                env,
                {
                  searchRequestId: searchRequest.id,
                  trips: batchTrips,
                },
                db,
              );
              batchTrips = [];
            }
          }
        }

        // Process remaining trips in final partial batch
        if (batchTrips.length > 0) {
          await upsertTrips(
            env,
            {
              searchRequestId: searchRequest.id,
              trips: batchTrips,
            },
            db,
          );
        }

        const processedThisPage = response.count;
        const newTotal = previousTotal + processedThisPage;

        // Cursor should only be set once from the first response
        // and then remain constant for all subsequent requests in this search
        const shouldSetCursor = currentCursor === undefined;

        await updateProgress(
          env,
          {
            id: searchRequest.id,
            cursor: shouldSetCursor ? response.cursor : undefined,
            hasMore: response.hasMore,
            processedCount: newTotal,
          },
          db,
        );

        return {
          cursor: response.cursor,
          hasMore: response.hasMore,
          processedCount: processedThisPage,
        };
      },
    );

    totalProcessed = previousTotal + pageResult.processedCount;

    if (!pageResult.hasMore) {
      return { totalProcessed };
    }

    // Set cursor from first response and keep it constant for all subsequent requests
    // The cursor provides consistent ordering; skip parameter handles pagination offset
    if (cursor === undefined) {
      cursor = pageResult.cursor;

      if (cursor === undefined) {
        workerLogger.warn(
          "Seats.aero first response missing cursor - pagination may be inconsistent",
          {
            pageIndex,
            searchRequestId: searchRequest.id,
          },
        );
        return { totalProcessed };
      }
    }

    pageIndex += 1;
  }
}
