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
import {
  addBreadcrumb,
  captureException,
  type ObservabilityContext,
  setUser,
  traceWorkflowLifecycle,
  withStepTracing,
} from "../utils/observability";

interface ProcessAlertsParams {
  userId: string;
}

class ProcessFlightAlertsWorkflowBase extends WorkflowEntrypoint<
  WorkerEnv,
  ProcessAlertsParams
> {
  async run(event: WorkflowEvent<ProcessAlertsParams>, step: WorkflowStep) {
    const { userId } = event.payload;

    const context: ObservabilityContext = {
      workflow: "ProcessFlightAlertsWorkflow",
      userId,
      instanceId: event.instanceId,
    };

    // Set Sentry user context
    setUser(userId, { workflow: "ProcessFlightAlertsWorkflow" });

    const lifecycle = traceWorkflowLifecycle(
      "ProcessFlightAlertsWorkflow",
      event.instanceId,
      context,
    );
    lifecycle.start();

    workerLogger.workflow.start(
      "ProcessFlightAlertsWorkflow",
      event.instanceId,
      context,
    );

    // Validate user has active alerts (defense-in-depth)
    const hasActiveAlerts = await withStepTracing(
      "validate-user-has-active-alerts",
      context,
      async () => {
        return await step.do(
          "validate-user-has-active-alerts",
          {},
          async () => {
            const hasAlerts = await userHasActiveAlerts(this.env, userId);

            if (!hasAlerts) {
              workerLogger.warn(
                "User has no active alerts",
                {
                  userId,
                  instanceId: event.instanceId,
                },
                context,
              );

              addBreadcrumb(
                "Validation failed: no active alerts",
                { userId },
                "validation",
              );
            }

            return hasAlerts;
          },
        );
      },
    );

    // Skip processing if user has no active alerts
    if (!hasActiveAlerts) {
      const result = {
        success: false,
        reason: "User has no active daily alerts",
      };

      workerLogger.workflow.complete(
        "ProcessFlightAlertsWorkflow",
        event.instanceId,
        result,
        {
          ...context,
          reason: "no_active_alerts",
        },
      );

      lifecycle.complete(result);
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

// Export workflow without Sentry instrumentation to avoid timeout issues
// Sentry instrumentation can interfere with workflow step execution timing
// Error tracking is handled via captureException calls within the workflow
export const ProcessFlightAlertsWorkflow = ProcessFlightAlertsWorkflowBase;
