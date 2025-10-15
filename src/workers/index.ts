/**
 * Cloudflare Worker entry point
 * Handles cron triggers and queue consumption for flight alert processing
 */

import * as Sentry from "@sentry/cloudflare";
import type { QueueMessage, WorkerEnv } from "./env";
import { getClientIp, getUserAgent, validateApiKey } from "./utils/auth";
import { workerLogger } from "./utils/logger";
import { captureException, getSentryOptions, setTag } from "./utils/sentry";
import { CheckFlightAlertsWorkflow } from "./workflows/check-flight-alerts";
import { ProcessFlightAlertsWorkflow } from "./workflows/process-flight-alerts";
import { ProcessSeatsAeroSearchWorkflow } from "./workflows/process-seats-aero-search";

export {
  CheckFlightAlertsWorkflow,
  ProcessFlightAlertsWorkflow,
  ProcessSeatsAeroSearchWorkflow,
};

const handlers = {
  /**
   * Cron handler - runs every 6 hours
   */
  async scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    setTag("handler", "scheduled");
    setTag("cron", controller.cron);

    // Start monitor with proper configuration
    const checkInId = Sentry.captureCheckIn(
      {
        monitorSlug: "check-flight-alerts-cron",
        status: "in_progress",
      },
      {
        schedule: { type: "crontab", value: "0 */6 * * *" },
        checkinMargin: 5,
        maxRuntime: 30,
        timezone: "UTC",
      },
    );

    const finishMonitor = (status: "ok" | "error") => {
      Sentry.captureCheckIn({
        checkInId,
        status,
        monitorSlug: "check-flight-alerts-cron",
      });
    };

    try {
      workerLogger.info("Cron triggered", {
        scheduledTime: controller.scheduledTime,
      });

      // Create unique workflow instance
      const now = new Date();
      const instanceId = `CheckFlightAlertsWorkflow_${now.toISOString().split("T")[0]}_${now.toISOString().split("T")[1].substring(0, 5).replace(":", "-")}`;

      const instance = await env.CHECK_ALERTS_WORKFLOW.create({
        id: instanceId,
        params: {},
      });

      workerLogger.info("Started CheckFlightAlertsWorkflow", {
        instanceId: instance.id,
      });
      finishMonitor("ok");
    } catch (error) {
      workerLogger.error("Cron execution failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      captureException(error, { handler: "scheduled" });
      finishMonitor("error");
      throw error;
    }
  },

  /**
   * Queue consumer - processes user IDs from flights-tracker-alerts-queue
   */
  async queue(
    batch: MessageBatch<QueueMessage>,
    env: WorkerEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    setTag("handler", "queue");
    setTag("batch_size", batch.messages.length);

    workerLogger.info("Processing queue batch", {
      messageCount: batch.messages.length,
    });

    for (const message of batch.messages) {
      const { userId } = message.body;

      if (!userId) {
        workerLogger.warn("Invalid message - missing userId", {
          messageId: message.id,
        });
        message.ack();
        continue;
      }

      try {
        const date = new Date().toISOString().split("T")[0];
        const instanceId = `ProcessFlightAlertsWorkflow_${userId}_${date}`;

        await env.PROCESS_ALERTS_WORKFLOW.create({
          id: instanceId,
          params: { userId },
        });

        message.ack();

        workerLogger.info("Started workflow for user", {
          userId,
          instanceId,
        });
      } catch (error) {
        workerLogger.error("Failed to start workflow", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });

        captureException(error, {
          userId,
          messageId: message.id,
          handler: "queue",
        });

        message.retry({ delaySeconds: 60 });
      }
    }
  },

  /**
   * HTTP handler - for debugging
   */
  async fetch(
    request: Request,
    env: WorkerEnv,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    setTag("handler", "fetch");

    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          timestamp: new Date().toISOString(),
        });
      }

      // Manual trigger for testing (processes all users)
      if (
        url.pathname === "/trigger/check-alerts" &&
        request.method === "POST"
      ) {
        // Get client information for logging
        const clientIp = getClientIp(request);
        const userAgent = getUserAgent(request);

        // Step 1: Validate API key
        const authResult = validateApiKey(request, env);
        if (!authResult.authenticated) {
          workerLogger.warn("Unauthorized trigger attempt", {
            reason: authResult.reason,
            clientIp,
            userAgent,
          });

          return Response.json(
            {
              error: "Unauthorized",
              message: authResult.reason,
            },
            { status: 401 },
          );
        }

        // Step 2: Create workflow instance
        const now = new Date();
        const date = now.toISOString().split("T")[0];
        const time = now
          .toISOString()
          .split("T")[1]
          .substring(0, 5)
          .replace(":", "-"); // HH-MM format
        const instanceId = `CheckFlightAlertsWorkflow_${date}_${time}_manual`;

        const instance = await env.CHECK_ALERTS_WORKFLOW.create({
          id: instanceId,
          params: {},
        });

        // Step 3: Audit log
        workerLogger.info("Manually triggered CheckFlightAlertsWorkflow", {
          instanceId,
          clientIp,
          userAgent,
          authenticated: true,
        });

        // Send to Sentry for audit trail
        captureException(new Error("Manual workflow trigger"), {
          level: "info",
          tags: {
            event_type: "manual_trigger",
            workflow: "check-flight-alerts",
          },
          extra: {
            instanceId,
            clientIp,
            userAgent,
          },
        });

        return Response.json({
          success: true,
          instanceId: instance.id,
          status: await instance.status(),
        });
      }

      // Trigger seats.aero search workflow
      if (
        url.pathname === "/trigger/seats-aero-search" &&
        request.method === "POST"
      ) {
        // Get client information for logging
        const clientIp = getClientIp(request);
        const userAgent = getUserAgent(request);

        // Step 1: Validate API key
        const authResult = validateApiKey(request, env);
        if (!authResult.authenticated) {
          workerLogger.warn("Unauthorized seats.aero search trigger attempt", {
            reason: authResult.reason,
            clientIp,
            userAgent,
          });

          return Response.json(
            {
              error: "Unauthorized",
              message: authResult.reason,
            },
            { status: 401 },
          );
        }

        // Step 2: Parse and validate request body
        const body = (await request.json()) as {
          originAirport: string;
          destinationAirport: string;
          searchStartDate: string;
          searchEndDate: string;
        };

        // Validate required fields
        if (
          !body.originAirport ||
          !body.destinationAirport ||
          !body.searchStartDate ||
          !body.searchEndDate
        ) {
          return Response.json(
            {
              error: "Bad Request",
              message:
                "Missing required fields: originAirport, destinationAirport, searchStartDate, searchEndDate",
            },
            { status: 400 },
          );
        }

        // Step 3: Determine instance ID with retry logic
        const baseInstanceId = `ProcessSeatsAeroSearch_${body.originAirport}_${body.destinationAirport}_${body.searchStartDate}_${body.searchEndDate}`;
        let instanceId = baseInstanceId;
        let _shouldCreateNew = true;

        // Check if workflow instance already exists
        try {
          const existingInstance =
            await env.SEATS_AERO_SEARCH_WORKFLOW.get(baseInstanceId);
          const status = await existingInstance.status();

          if (
            status.status === "complete" ||
            status.status === "running" ||
            status.status === "queued" ||
            status.status === "paused"
          ) {
            // Workflow is active or completed, return existing instance
            workerLogger.info("Returning existing workflow instance", {
              instanceId: baseInstanceId,
              status: status.status,
            });

            return Response.json({
              success: true,
              instanceId: existingInstance.id,
              status,
            });
          }

          // Workflow is in terminal failed state, create new instance with retry suffix
          if (status.status === "errored" || status.status === "terminated") {
            instanceId = `${baseInstanceId}_retry_${Date.now()}`;
            workerLogger.info("Creating retry workflow instance", {
              originalId: baseInstanceId,
              retryId: instanceId,
              previousStatus: status.status,
            });
          }
        } catch (_error) {
          // Instance doesn't exist, use original ID
          workerLogger.info(
            "No existing workflow found, creating new instance",
            {
              instanceId: baseInstanceId,
            },
          );
          _shouldCreateNew = true;
        }

        // Step 4: Create workflow instance
        const instance = await env.SEATS_AERO_SEARCH_WORKFLOW.create({
          id: instanceId,
          params: body,
        });

        // Step 5: Audit log
        workerLogger.info("Triggered seats.aero search workflow", {
          instanceId,
          route: `${body.originAirport}-${body.destinationAirport}`,
          dates: `${body.searchStartDate} to ${body.searchEndDate}`,
          clientIp,
          userAgent,
          authenticated: true,
        });

        return Response.json({
          success: true,
          instanceId: instance.id,
          status: await instance.status(),
        });
      }

      return Response.json({
        message: "Flights Tracker Worker",
        endpoints: {
          health: "GET /health",
          triggerCheck:
            "POST /trigger/check-alerts (manual testing - processes all users)",
          triggerSeatsAero:
            "POST /trigger/seats-aero-search (trigger seats.aero data fetch)",
        },
      });
    } catch (error) {
      captureException(error, {
        handler: "fetch",
        url: request.url,
        method: request.method,
      });

      return Response.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }
  },
};

// Wrap handlers with Sentry
export default Sentry.withSentry(
  (env: WorkerEnv) => getSentryOptions(env),
  handlers,
);
