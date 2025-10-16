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
import { addBreadcrumb, captureException } from "../utils/sentry";

interface WorkflowParams {
  monitorSlug?: string;
  scheduleType?: string;
}

class CheckFlightAlertsWorkflowBase extends WorkflowEntrypoint<
  WorkerEnv,
  WorkflowParams
> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    addBreadcrumb("CheckFlightAlertsWorkflow started");

    const { monitorSlug, scheduleType } = event.payload;
    let checkInId: string | undefined;

    // Start monitor if this is a scheduled run
    if (monitorSlug && scheduleType === "cron") {
      checkInId = Sentry.captureCheckIn(
        {
          monitorSlug,
          status: "in_progress",
        },
        {
          schedule: { type: "crontab", value: "0 */6 * * *" },
          checkinMargin: 5,
          maxRuntime: 30,
          timezone: "UTC",
        },
      );
      addBreadcrumb("Started monitor check-in", { monitorSlug, checkInId });
    }

    try {
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

      await step.do("queue-users-for-processing", {}, async () => {
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

      // Finish monitor if this was a scheduled run
      if (checkInId && monitorSlug) {
        Sentry.captureCheckIn({
          checkInId,
          status: "ok",
          monitorSlug,
        });
        addBreadcrumb("Completed monitor check-in", {
          monitorSlug,
          status: "ok",
        });
        workerLogger.info("Monitor check-in completed successfully", {
          monitorSlug,
          checkInId,
        });
      }
    } catch (error) {
      // Report workflow failure to monitor if this was a scheduled run
      if (checkInId && monitorSlug) {
        Sentry.captureCheckIn({
          checkInId,
          status: "error",
          monitorSlug,
        });
        addBreadcrumb("Failed monitor check-in", {
          monitorSlug,
          status: "error",
        });
        workerLogger.error("Monitor check-in failed", {
          monitorSlug,
          checkInId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Re-throw the error to maintain workflow failure semantics
      throw error;
    }
  }
}

// Export instrumented workflow
export const CheckFlightAlertsWorkflow = Sentry.instrumentWorkflowWithSentry(
  (env: WorkerEnv) => ({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: 1.0,
  }),
  CheckFlightAlertsWorkflowBase,
);
