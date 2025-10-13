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

export { CheckFlightAlertsWorkflow, ProcessFlightAlertsWorkflow };

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

    try {
      workerLogger.info("Cron triggered", {
        scheduledTime: controller.scheduledTime,
      });

      const date = new Date().toISOString().split("T")[0];
      const instanceId = `CheckFlightAlertsWorkflow_${date}`;

      const instance = await env.CHECK_ALERTS_WORKFLOW.create({
        id: instanceId,
        params: {},
      });

      workerLogger.info("Started CheckFlightAlertsWorkflow", {
        instanceId: instance.id,
      });
    } catch (error) {
      captureException(error, {
        handler: "scheduled",
        scheduledTime: controller.scheduledTime,
      });
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
        const date = new Date().toISOString().split("T")[0];
        const instanceId = `CheckFlightAlertsWorkflow_${date}_manual`;

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

      return Response.json({
        message: "Flights Tracker Worker",
        endpoints: {
          health: "GET /health",
          triggerCheck:
            "POST /trigger/check-alerts (manual testing - processes all users)",
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
export default getSentryOptions
  ? Sentry.withSentry((env: WorkerEnv) => getSentryOptions(env), handlers)
  : handlers;
