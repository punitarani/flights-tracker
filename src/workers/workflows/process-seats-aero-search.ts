/**
 * ProcessSeatsAeroSearchWorkflow
 * Fetches award flight availability data from seats.aero API in the background
 * Instance ID pattern: ProcessSeatsAeroSearch_{origin}_{dest}_{startDate}_{endDate}
 */

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { SearchRequestParams } from "@/core/seats-aero.db";
import { createSeatsAeroClient } from "@/lib/fli/seats-aero/client";
import {
  completeSearchRequest,
  failSearchRequest,
  getSearchRequest,
  updateSearchRequestProgress,
  upsertAvailabilityTrip,
} from "../adapters/seats-aero.db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { addBreadcrumb, captureException } from "../utils/sentry";

export class ProcessSeatsAeroSearchWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  SearchRequestParams
> {
  async run(event: WorkflowEvent<SearchRequestParams>, step: WorkflowStep) {
    const {
      originAirport,
      destinationAirport,
      searchStartDate,
      searchEndDate,
    } = event.payload;

    addBreadcrumb("ProcessSeatsAeroSearchWorkflow started", {
      route: `${originAirport}-${destinationAirport}`,
      dates: `${searchStartDate} to ${searchEndDate}`,
      instanceId: event.instanceId,
    });

    workerLogger.info("Starting ProcessSeatsAeroSearchWorkflow", {
      originAirport,
      destinationAirport,
      searchStartDate,
      searchEndDate,
      instanceId: event.instanceId,
    });

    // Step 1: Validate search request exists (defensive check)
    const searchRequest = await step.do("validate-search-request", async () => {
      const search = await getSearchRequest(this.env, {
        originAirport,
        destinationAirport,
        searchStartDate,
        searchEndDate,
      });

      if (!search) {
        const error = new Error("Search request not found in database");
        workerLogger.error("Search request validation failed", {
          originAirport,
          destinationAirport,
          instanceId: event.instanceId,
        });
        throw error;
      }

      workerLogger.info("Search request validated", {
        searchRequestId: search.id,
        status: search.status,
      });

      return search;
    });

    // Step 2: Fetch data from seats.aero API with pagination
    await step.do(
      "fetch-and-store-data",
      {
        retries: {
          limit: 3,
          delay: "5 minutes",
          backoff: "exponential",
        },
        timeout: "30 minutes",
      },
      async () => {
        try {
          const client = createSeatsAeroClient({
            apiKey: this.env.SEATS_AERO_API_KEY,
          });

          let cursor: number | undefined;
          let totalProcessed = 0;

          workerLogger.info("Starting API pagination", {
            searchRequestId: searchRequest.id,
          });

          do {
            // Fetch page from API
            const response = await client.search({
              origin_airport: originAirport,
              destination_airport: destinationAirport,
              start_date: searchStartDate,
              end_date: searchEndDate,
              include_trips: true,
              take: 1000,
              only_direct_flights: false,
              include_filtered: false,
              cursor,
            });

            workerLogger.info("Fetched API page", {
              count: response.count,
              hasMore: response.hasMore,
              cursor: response.cursor,
            });

            // Store each trip in database
            for (const availability of response.data) {
              for (const trip of availability.AvailabilityTrips) {
                await upsertAvailabilityTrip(this.env, {
                  searchRequestId: searchRequest.id,
                  trip,
                });
              }
            }

            totalProcessed += response.count;

            // Update progress in search request
            await updateSearchRequestProgress(this.env, {
              id: searchRequest.id,
              cursor: response.cursor,
              hasMore: response.hasMore,
              processedCount: totalProcessed,
            });

            addBreadcrumb("Processed API page", {
              count: response.count,
              totalProcessed,
              hasMore: response.hasMore,
            });

            // Check if more pages exist
            cursor = response.hasMore ? response.cursor : undefined;
          } while (cursor !== undefined);

          // Mark search as completed
          await completeSearchRequest(this.env, searchRequest.id);

          workerLogger.info("Completed seats.aero search", {
            searchRequestId: searchRequest.id,
            totalProcessed,
            instanceId: event.instanceId,
          });

          addBreadcrumb("Search completed", {
            totalProcessed,
          });

          return { success: true, totalProcessed };
        } catch (error) {
          // Mark search as failed
          await failSearchRequest(
            this.env,
            searchRequest.id,
            error instanceof Error ? error.message : "Unknown error",
          );

          workerLogger.error("Search failed", {
            searchRequestId: searchRequest.id,
            error: error instanceof Error ? error.message : String(error),
            instanceId: event.instanceId,
          });

          captureException(error, {
            workflow: "process-seats-aero-search",
            searchRequestId: searchRequest.id,
            route: `${originAirport}-${destinationAirport}`,
            instanceId: event.instanceId,
          });

          throw error;
        }
      },
    );
  }
}
