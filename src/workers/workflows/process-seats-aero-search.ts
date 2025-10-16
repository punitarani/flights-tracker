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
import {
  captureException,
  type ObservabilityContext,
  traceWorkflowLifecycle,
  withStepTracing,
} from "../utils/observability";
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

    const context: ObservabilityContext = {
      workflow: "ProcessSeatsAeroSearchWorkflow",
      instanceId: event.instanceId,
      route: `${originAirport}-${destinationAirport}`,
      originAirport,
      destinationAirport,
      searchStartDate,
      searchEndDate,
    };

    const lifecycle = traceWorkflowLifecycle(
      "ProcessSeatsAeroSearchWorkflow",
      event.instanceId,
      context,
    );
    lifecycle.start();

    workerLogger.workflow.start(
      "ProcessSeatsAeroSearchWorkflow",
      event.instanceId,
      context,
    );

    // Step 1: Validate search request exists (defensive check)
    const searchRequest = await withStepTracing(
      "validate-search-request",
      context,
      async () => {
        return await step.do("validate-search-request", {}, async () => {
          const search = await getSearchRequest(this.env, {
            originAirport,
            destinationAirport,
            searchStartDate,
            searchEndDate,
          });

          if (!search) {
            const error = new Error("Search request not found in database");
            workerLogger.error(
              "Search request validation failed",
              {
                originAirport,
                destinationAirport,
                instanceId: event.instanceId,
              },
              context,
            );
            throw error;
          }

          workerLogger.step.complete("validate-search-request", undefined, {
            ...context,
            searchRequestId: search.id,
          });

          return search;
        });
      },
    );

    const client = createSeatsAeroClient({
      apiKey: this.env.SEATS_AERO_API_KEY,
    });

    const { totalProcessed } = await withStepTracing(
      "paginate-search",
      { ...context, searchRequestId: searchRequest.id },
      async () => {
        return await paginateSeatsAeroSearch({
          client,
          env: this.env,
          params: event.payload,
          searchRequest,
          step,
        });
      },
    );

    await withStepTracing(
      "complete-search",
      { ...context, searchRequestId: searchRequest.id },
      async () => {
        await completeSearchRequest(this.env, searchRequest.id);
      },
    );

    const result = { success: true, totalProcessed };

    workerLogger.workflow.complete(
      "ProcessSeatsAeroSearchWorkflow",
      event.instanceId,
      result,
      {
        ...context,
        searchRequestId: searchRequest.id,
        totalProcessed,
      },
    );

    lifecycle.complete(result);

    return result;
  }

  private async handleWorkflowFailure(
    event: WorkflowEvent<SearchRequestParams>,
    error: unknown,
  ) {
    const { originAirport, destinationAirport } = event.payload;

    const context: ObservabilityContext = {
      workflow: "ProcessSeatsAeroSearchWorkflow",
      instanceId: event.instanceId,
      route: `${originAirport}-${destinationAirport}`,
      originAirport,
      destinationAirport,
    };

    const lifecycle = traceWorkflowLifecycle(
      "ProcessSeatsAeroSearchWorkflow",
      event.instanceId,
      context,
    );
    lifecycle.fail(error);

    // Get the search request ID to mark it as failed
    const searchRequest = await getSearchRequest(this.env, event.payload);
    if (!searchRequest) {
      workerLogger.error(
        "Cannot mark search as failed - search request not found",
        {
          route: `${originAirport}-${destinationAirport}`,
          instanceId: event.instanceId,
        },
        context,
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

    workerLogger.workflow.fail(
      "ProcessSeatsAeroSearchWorkflow",
      event.instanceId,
      error,
      {
        ...context,
        searchRequestId: searchRequest.id,
      },
    );

    captureException(error, {
      ...context,
      searchRequestId: searchRequest.id,
      component: "workflow",
      level: "error",
      retryable: false,
    });
  }
}

// Export workflow without Sentry instrumentation to avoid timeout issues
// Sentry instrumentation can interfere with workflow step execution timing
// Error tracking is handled via captureException calls within the workflow
export const ProcessSeatsAeroSearchWorkflow =
  ProcessSeatsAeroSearchWorkflowBase;
