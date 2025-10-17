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
} from "../adapters/seats-aero.db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { addBreadcrumb, captureException } from "../utils/sentry";
import { paginateSeatsAeroSearch } from "./process-seats-aero-search-pagination";

/**
 * ProcessSeatsAeroSearchWorkflow
 *
 * Note: Sentry instrumentation via instrumentWorkflowWithSentry was removed
 * as it interfered with Cloudflare's workflow step execution causing timeouts.
 * Error tracking is preserved through captureException calls within the workflow.
 */
export class ProcessSeatsAeroSearchWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  SearchRequestParams
> {
  async run(event: WorkflowEvent<SearchRequestParams>, step: WorkflowStep) {
    const startTime = Date.now();

    try {
      workerLogger.info("Workflow started", {
        instanceId: event.instanceId,
        timestamp: event.timestamp,
        params: event.payload,
      });

      const result = await this.runWorkflow(event, step);

      const duration = Date.now() - startTime;
      workerLogger.info("Workflow completed successfully", {
        instanceId: event.instanceId,
        duration,
        totalProcessed: result.totalProcessed,
      });

      return result;
    } catch (error) {
      // This catch block only executes when the entire workflow fails
      // (i.e., after all step retries and workflow retries are exhausted)
      const duration = Date.now() - startTime;

      workerLogger.error("Workflow failed permanently", {
        instanceId: event.instanceId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      await this.handleWorkflowFailure(event, error);
      throw error;
    }
  }

  private async runWorkflow(
    event: WorkflowEvent<SearchRequestParams>,
    step: WorkflowStep,
  ) {
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
    const searchRequest = await step.do(
      "validate-search-request",
      {},
      async () => {
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
      },
    );

    const client = createSeatsAeroClient({
      apiKey: this.env.SEATS_AERO_API_KEY,
    });

    // Step 2: Paginate through seats.aero API and store results
    const { totalProcessed } = await paginateSeatsAeroSearch({
      client,
      env: this.env,
      params: event.payload,
      searchRequest,
      step,
    });

    // Step 3: Mark search as completed (with retry capability)
    await step.do(
      "mark-search-completed",
      {
        retries: {
          limit: 3,
          delay: "5 seconds" as const,
          backoff: "constant" as const,
        },
      },
      async () => {
        await completeSearchRequest(this.env, searchRequest.id);

        workerLogger.info("Marked search as completed", {
          searchRequestId: searchRequest.id,
          totalProcessed,
        });

        return { completed: true };
      },
    );

    workerLogger.info("Completed seats.aero search workflow", {
      searchRequestId: searchRequest.id,
      totalProcessed,
      instanceId: event.instanceId,
    });

    addBreadcrumb("Search completed", {
      searchRequestId: searchRequest.id,
      totalProcessed,
    });

    return { success: true, totalProcessed };
  }

  private async handleWorkflowFailure(
    event: WorkflowEvent<SearchRequestParams>,
    error: unknown,
  ) {
    const { originAirport, destinationAirport } = event.payload;

    // Get the search request ID to mark it as failed
    const searchRequest = await getSearchRequest(this.env, event.payload);
    if (!searchRequest) {
      workerLogger.error(
        "Cannot mark search as failed - search request not found",
        {
          route: `${originAirport}-${destinationAirport}`,
          instanceId: event.instanceId,
        },
      );
      return;
    }

    // Mark the search request as failed in the database
    await failSearchRequest(
      this.env,
      searchRequest.id,
      error instanceof Error
        ? error.message
        : "Workflow failed after all retries",
    );

    workerLogger.error(
      "Workflow permanently failed - marked search as failed",
      {
        searchRequestId: searchRequest.id,
        error: error instanceof Error ? error.message : String(error),
        route: `${originAirport}-${destinationAirport}`,
        instanceId: event.instanceId,
      },
    );

    captureException(error, {
      workflow: "process-seats-aero-search",
      searchRequestId: searchRequest.id,
      route: `${originAirport}-${destinationAirport}`,
      instanceId: event.instanceId,
      level: "final_failure",
    });

    addBreadcrumb("Workflow permanently failed", {
      searchRequestId: searchRequest.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
