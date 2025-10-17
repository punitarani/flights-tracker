import type { SearchRequestParams } from "@/core/seats-aero.db";
import type { SeatsAeroSearchRequest } from "@/db/schema";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";
import { parallel, unique } from "radash";
import {
  updateSearchRequestProgress,
  upsertAvailabilityTrips,
} from "../adapters/seats-aero.db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { addBreadcrumb, captureException } from "../utils/sentry";

type SeatsAeroSearchResponse = {
  count: number;
  hasMore: boolean;
  cursor?: number;
  data: Array<{
    AvailabilityTrips: AvailabilityTrip[] | null;
  }>;
};

export interface SeatsAeroClientLike {
  search: (params: {
    origin_airport: string;
    destination_airport: string;
    start_date: string;
    end_date: string;
    include_trips: boolean;
    take: number;
    only_direct_flights: boolean;
    include_filtered: boolean;
    cursor?: number;
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

    const pageResult = await step.do(
      `fetch-page-${pageIndex + 1}`,
      stepOptions,
      async () => {
        const response = await client.search({
          origin_airport: params.originAirport,
          destination_airport: params.destinationAirport,
          start_date: params.searchStartDate,
          end_date: params.searchEndDate,
          include_trips: true,
          take: 1000,
          only_direct_flights: false,
          include_filtered: false,
          cursor: currentCursor,
        });

        workerLogger.info("Fetched API page", {
          pageIndex,
          count: response.count,
          hasMore: response.hasMore,
          cursor: response.cursor,
          searchRequestId: searchRequest.id,
        });

        // Extract and deduplicate trips using radash
        const allTrips: AvailabilityTrip[] = [];
        for (const availability of response.data) {
          if (availability.AvailabilityTrips) {
            allTrips.push(...availability.AvailabilityTrips);
          }
        }
        
        // Deduplicate by trip ID using radash
        const trips = unique(allTrips, (t) => t.ID);
        
        workerLogger.info("Processing unique trips", {
          totalTrips: allTrips.length,
          uniqueTrips: trips.length,
          deduped: allTrips.length - trips.length,
          searchRequestId: searchRequest.id,
        });

        // Batch trips into groups of 10 for database insertion
        const batchSize = 10;
        const batches: AvailabilityTrip[][] = [];
        for (let start = 0; start < trips.length; start += batchSize) {
          batches.push(trips.slice(start, start + batchSize));
        }

        // Process batches sequentially to avoid overwhelming database
        // Each batch is processed with proper error handling
        for (let i = 0; i < batches.length; i++) {
          try {
            await upsertTrips(env, {
              searchRequestId: searchRequest.id,
              trips: batches[i],
            });
          } catch (error) {
            workerLogger.error("Failed to upsert batch", {
              batchIndex: i + 1,
              batchSize: batches[i].length,
              searchRequestId: searchRequest.id,
              error: error instanceof Error ? error.message : String(error),
            });
            
            captureException(error, {
              context: "pagination-upsert-batch",
              batchIndex: i + 1,
              pageIndex,
              searchRequestId: searchRequest.id,
            });
            
            throw error; // Re-throw to trigger step retry
          }
        }

        const processedThisPage = response.count;
        const newTotal = previousTotal + processedThisPage;

        await updateProgress(env, {
          id: searchRequest.id,
          cursor: response.cursor,
          hasMore: response.hasMore,
          processedCount: newTotal,
        });

        addBreadcrumb("Processed API page", {
          pageIndex,
          count: response.count,
          totalProcessed: newTotal,
          hasMore: response.hasMore,
        });

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

    if (pageResult.cursor === undefined) {
      workerLogger.warn(
        "Seats.aero response indicated more data but cursor was undefined",
        {
          pageIndex,
          searchRequestId: searchRequest.id,
        },
      );

      return { totalProcessed };
    }

    cursor = pageResult.cursor;
    pageIndex += 1;
  }
}
