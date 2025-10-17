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
import * as Sentry from "@sentry/cloudflare";
import { getUserIdsWithActiveDailyAlerts } from "../adapters/alerts.db";
import type { WorkerEnv } from "../env";
import { workerLogger } from "../utils/logger";
import { getSentryOptions } from "../utils/sentry";

export class CheckFlightAlertsWorkflow extends WorkflowEntrypoint<
  WorkerEnv,
  Record<string, never>
> {
  async run(event: WorkflowEvent<Record<string, never>>, step: WorkflowStep) {
    // Instrument workflow with Sentry for tracing and error tracking
    return await Sentry.instrumentWorkflowWithSentry(
      event,
      this.env,
      getSentryOptions,
      async () => {
        const userIds = await step.do(
          "fetch-user-ids-with-active-alerts",
          {},
          async () => {
            return await Sentry.startSpan(
              {
                name: "fetch-user-ids-with-active-alerts",
                op: "db.query",
              },
              async () => {
                workerLogger.info("Fetching user IDs with active daily alerts");
                const ids = await getUserIdsWithActiveDailyAlerts(this.env);
                workerLogger.info("Found users with active alerts", {
                  count: ids.length,
                });
                return ids;
              },
            );
          },
        );

        if (userIds.length === 0) {
          workerLogger.info("No users with active alerts found");
          return { queued: 0 };
        }

        await step.do("queue-users-for-processing", {}, async () => {
          return await Sentry.startSpan(
            {
              name: "queue-users-for-processing",
              op: "queue.send",
              attributes: { userCount: userIds.length },
            },
            async () => {
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
              return { queued: totalQueued };
            },
          );
        });
      },
    );
  }
}
