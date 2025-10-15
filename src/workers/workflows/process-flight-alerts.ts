/**
 * ProcessFlightAlertsWorkflow
 * Processes all alerts for a single user
 * Instance ID pattern: ProcessFlightAlertsWorkflow_{userId}_{YYYY-MM-DD}
 */

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { processDailyAlertsForUser } from "../adapters/alert-processing";
import { userHasActiveAlerts } from "../adapters/alerts.db";
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

    // Validate user has active alerts (defense-in-depth)
    const hasActiveAlerts = await step.do(
      "validate-user-has-active-alerts",
      async () => {
        const hasAlerts = await userHasActiveAlerts(this.env, userId);

        if (!hasAlerts) {
          workerLogger.warn("User has no active alerts", {
            userId,
            instanceId: event.instanceId,
          });

          addBreadcrumb("Validation failed: no active alerts", { userId });
        }

        return hasAlerts;
      },
    );

    // Skip processing if user has no active alerts
    if (!hasActiveAlerts) {
      const result = {
        success: false,
        reason: "User has no active daily alerts",
      };

      workerLogger.info("Skipping workflow - no active alerts", {
        userId,
        instanceId: event.instanceId,
      });

      return result;
    }

    const result = await step.do(
      `process-alerts-for-user-${userId}`,
      {
        retries: {
          limit: 5,
          delay: "1 minute",
          backoff: "exponential",
        },
        timeout: "10 minutes",
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
