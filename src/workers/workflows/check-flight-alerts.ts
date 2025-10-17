/**
 * CheckFlightAlertsWorkflow
 * Triggered by cron every 6 hours
 * Fetches all user IDs with active daily alerts and queues them
 */

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { getUserIdsWithActiveDailyAlerts } from "../adapters/alerts.db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { withSentryMonitor } from "../utils/monitor-wrapper";
import {
  addBreadcrumb,
  captureException,
  runWorkflowWithSentry,
} from "../utils/sentry";

/**
 * CheckFlightAlertsWorkflow
 * Triggered by cron every 6 hours
 * Fetches all user IDs with active daily alerts and queues them
 *
 * Note: Sentry instrumentation via instrumentWorkflowWithSentry was removed
 * as it interfered with Cloudflare's workflow step execution causing timeouts.
 * Error tracking is preserved through captureException calls within the workflow.
 * Cron monitoring is still tracked via withSentryMonitor wrapper.
 */
class CheckFlightAlertsWorkflowClass extends WorkflowEntrypoint<
  WorkerEnv,
  Record<string, never>
> {
  async run(event: WorkflowEvent<Record<string, never>>, step: WorkflowStep) {
    return runWorkflowWithSentry(
      this.env,
      {
        workflow: "check-flight-alerts",
        instanceId: event.instanceId,
      },
      async () => {
        addBreadcrumb("CheckFlightAlertsWorkflow started");

        const userIds = await step.do(
          "fetch-user-ids-with-active-alerts",
          {},
          async () => {
            try {
              workerLogger.info("Fetching user IDs with active daily alerts");
              const ids = await getUserIdsWithActiveDailyAlerts(this.env);
              workerLogger.info("Found users with active alerts", {
                count: ids.length,
              });
              addBreadcrumb("Fetched user IDs", { count: ids.length });
              return ids;
            } catch (error) {
              captureException(error, {
                workflow: "check-flight-alerts",
                step: "fetch-user-ids",
              });
              throw error;
            }
          },
        );

        if (userIds.length === 0) {
          workerLogger.info("No users with active alerts found");
          return { queued: 0 };
        }

        return step.do("queue-users-for-processing", {}, async () => {
          try {
            workerLogger.info("Queuing users for alert processing", {
              count: userIds.length,
            });

            // Queue messages in batches of 100 (Cloudflare's limit per sendBatch call)
            const BATCH_SIZE = 100;
            let totalQueued = 0;

            for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
              const batch = userIds.slice(i, i + BATCH_SIZE);

              await this.env.ALERTS_QUEUE.sendBatch(
                batch.map((userId) => ({
                  body: { userId },
                })),
              );

              totalQueued += batch.length;

              workerLogger.info("Queued batch", {
                batchNumber: Math.floor(i / BATCH_SIZE) + 1,
                batchSize: batch.length,
                totalQueued,
              });
            }

            workerLogger.info("Successfully queued all users", {
              totalQueued,
            });
            addBreadcrumb("Completed queuing", { totalQueued });
            return { queued: totalQueued };
          } catch (error) {
            captureException(error, {
              workflow: "check-flight-alerts",
              step: "queue-users",
              userCount: userIds.length,
            });
            throw error;
          }
        });
      },
    );
  }
}

// Export with monitor wrapper for cron monitoring only
// instrumentWorkflowWithSentry removed to prevent step execution interference
export const CheckFlightAlertsWorkflow = withSentryMonitor(
  CheckFlightAlertsWorkflowClass,
  {
    slug: "check-flight-alerts-cron",
    schedule: "0 */6 * * *",
    checkinMargin: 5,
    maxRuntime: 30,
    timezone: "UTC",
  },
);
