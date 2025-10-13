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
import { getUserIdsWithActiveDailyAlerts } from "../adapters/alerts-db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { addBreadcrumb, captureException } from "../utils/sentry";

export class CheckFlightAlertsWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  Record<string, never>
> {
  async run(_event: WorkflowEvent<Record<string, never>>, step: WorkflowStep) {
    addBreadcrumb("CheckFlightAlertsWorkflow started");

    const userIds = await step.do(
      "fetch-user-ids-with-active-alerts",
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

    await step.do("queue-users-for-processing", async () => {
      if (userIds.length === 0) {
        workerLogger.info("No users to queue");
        return { queued: 0 };
      }

      try {
        // Send user IDs to queue in batches (max 100 per Cloudflare limits)
        const batchSize = 100;
        let totalQueued = 0;

        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);
          const messages = batch.map((userId) => ({
            body: { userId },
          }));

          await this.env.ALERTS_QUEUE.sendBatch(messages);
          totalQueued += batch.length;

          workerLogger.info("Queued batch", {
            batchNumber: Math.floor(i / batchSize) + 1,
            batchSize: batch.length,
          });

          addBreadcrumb("Queued batch", {
            batchNumber: Math.floor(i / batchSize) + 1,
            batchSize: batch.length,
          });
        }

        workerLogger.info("Successfully queued all users", { totalQueued });
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
  }
}
