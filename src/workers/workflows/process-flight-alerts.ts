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
import * as Sentry from "@sentry/cloudflare";
import { processDailyAlertsForUser } from "../adapters/alert-processing";
import { userHasActiveAlerts } from "../adapters/alerts.db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";

interface ProcessAlertsParams {
  userId: string;
  /**
   * Force send email regardless of eligibility checks
   * Used for manual testing/triggers via Cloudflare dashboard
   * @default false
   */
  forceSend?: boolean;
}

export class ProcessFlightAlertsWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  ProcessAlertsParams
> {
  async run(event: WorkflowEvent<ProcessAlertsParams>, step: WorkflowStep) {
    const { userId, forceSend = false } = event.payload;

    // Set user context for Sentry
    Sentry.setUser({ id: userId });

    workerLogger.info("Starting ProcessFlightAlertsWorkflow", {
      userId,
      instanceId: event.instanceId,
      forceSend,
    });

    // Validate user has active alerts (defense-in-depth)
    const hasActiveAlerts = await step.do(
      "validate-user-has-active-alerts",
      {},
      async () => {
        return await Sentry.startSpan(
          {
            name: "validate-user-has-active-alerts",
            op: "db.query",
            attributes: { userId },
          },
          async () => {
            const hasAlerts = await userHasActiveAlerts(this.env, userId);

            if (!hasAlerts) {
              workerLogger.warn("User has no active alerts", {
                userId,
                instanceId: event.instanceId,
              });
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
        return await Sentry.startSpan(
          {
            name: "process-daily-alerts",
            op: "task.process",
            attributes: { userId, forceSend },
          },
          async () => {
            const result = await processDailyAlertsForUser(
              this.env,
              userId,
              forceSend,
            );
            return result;
          },
        );
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
