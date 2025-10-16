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

class ProcessSeatsAeroSearchWorkflowBase extends WorkflowEntrypoint<
  WorkerEnv,
  SearchRequestParams
> {
  async run(event: WorkflowEvent<SearchRequestParams>, step: WorkflowStep) {
    try {
      return await this.runWorkflow(event, step);
    } catch (error) {
      // This catch block only executes when the entire workflow fails
      // (i.e., after all step retries and workflow retries are exhausted)
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

    const { totalProcessed } = await paginateSeatsAeroSearch({
      client,
      env: this.env,
      params: event.payload,
      searchRequest,
      step,
    });

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

// Export workflow without Sentry instrumentation to avoid timeout issues
// Sentry instrumentation can interfere with workflow step execution timing
// Error tracking is handled via captureException calls within the workflow
export const ProcessSeatsAeroSearchWorkflow = ProcessSeatsAeroSearchWorkflowBase;
