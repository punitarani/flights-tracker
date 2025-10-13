/**
 * ProcessFlightAlertsWorkflow
 * Processes all alerts for a single user
 * Instance ID pattern: process-alerts:{userId}:{YYYY-MM-DD}
 */

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { processDailyAlertsForUser } from "../adapters/alert-processing";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { addBreadcrumb, captureException, setUser } from "../utils/sentry";

interface ProcessAlertsParams {
  userId: string;
}

export class ProcessFlightAlertsWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  ProcessAlertsParams
> {
  async run(event: WorkflowEvent<ProcessAlertsParams>, step: WorkflowStep) {
    const { userId } = event.payload;

    // Set Sentry user context
    setUser(userId);
    addBreadcrumb("ProcessFlightAlertsWorkflow started", {
      userId,
      instanceId: event.instanceId,
    });

    workerLogger.info("Starting ProcessFlightAlertsWorkflow", {
      userId,
      instanceId: event.instanceId,
    });

    const result = await step.do(
      `process-alerts-for-user-${userId}`,
      {
        retries: {
          limit: 5,
          delay: "5 minutes",
          backoff: "exponential",
        },
        timeout: "15 minutes",
      },
      async () => {
        try {
          const result = await processDailyAlertsForUser(this.env, userId);

          addBreadcrumb("Processing completed", {
            userId,
            success: result.success,
            reason: result.reason,
          });

          return result;
        } catch (error) {
          captureException(error, {
            workflow: "process-flight-alerts",
            userId,
            instanceId: event.instanceId,
          });
          throw error;
        }
      },
    );

    workerLogger.info("Completed ProcessFlightAlertsWorkflow", {
      userId,
      instanceId: event.instanceId,
      success: result.success,
      reason: result.reason,
    });

    return result;
  }
}
