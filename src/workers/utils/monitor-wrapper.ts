/**
 * Sentry Monitor Wrapper for Cloudflare Workflows
 *
 * Provides a clean way to add Sentry cron monitoring to workflows
 * without mixing monitoring concerns with business logic.
 */

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import * as Sentry from "@sentry/cloudflare";
import { workerLogger } from "./logger";
import { addBreadcrumb, captureException } from "./sentry";

export interface MonitorConfig {
  slug: string;
  schedule: string;
  checkinMargin?: number;
  maxRuntime?: number;
  timezone?: string;
}

export interface MonitoredWorkflowParams {
  __monitorConfig?: MonitorConfig;
}

/**
 * Higher-order workflow class that wraps any workflow with Sentry monitoring
 *
 * Usage:
 * ```ts
 * class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
 *   async run(event, step) { ... }
 * }
 *
 * export const MonitoredWorkflow = withSentryMonitor(MyWorkflow, {
 *   slug: 'my-cron-job',
 *   schedule: '0 * * * *',
 *   maxRuntime: 30
 * });
 * ```
 */
export function withSentryMonitor<
  TEnv,
  TParams extends Record<string, unknown>,
>(
  // biome-ignore lint/suspicious/noExplicitAny: ctx type varies by runtime and Sentry instrumentation
  WorkflowClass: new (ctx: any, env: TEnv) => WorkflowEntrypoint<TEnv, TParams>,
  defaultConfig?: MonitorConfig,
) {
  return class MonitoredWorkflow extends WorkflowEntrypoint<
    TEnv,
    TParams & MonitoredWorkflowParams
  > {
    private workflow: WorkflowEntrypoint<TEnv, TParams>;

    // biome-ignore lint/suspicious/noExplicitAny: ctx is internal Cloudflare Workers context, type varies by runtime
    constructor(ctx: any, env: TEnv) {
      super(ctx, env);
      this.workflow = new WorkflowClass(ctx, env);
    }

    async run(
      event: WorkflowEvent<TParams & MonitoredWorkflowParams>,
      step: WorkflowStep,
    ) {
      // Extract monitor config from params or use default
      const monitorConfig = event.payload.__monitorConfig ?? defaultConfig;

      // If no monitor config, just run the workflow normally
      if (!monitorConfig) {
        return await this.workflow.run(event as WorkflowEvent<TParams>, step);
      }

      let checkInId: string | undefined;

      try {
        // Start monitor check-in
        checkInId = Sentry.captureCheckIn(
          {
            monitorSlug: monitorConfig.slug,
            status: "in_progress",
          },
          {
            schedule: { type: "crontab", value: monitorConfig.schedule },
            checkinMargin: monitorConfig.checkinMargin ?? 5,
            maxRuntime: monitorConfig.maxRuntime ?? 30,
            timezone: monitorConfig.timezone ?? "UTC",
          },
        );

        addBreadcrumb("Monitor check-in started", {
          monitorSlug: monitorConfig.slug,
          checkInId,
        });

        workerLogger.info("Monitor check-in started", {
          monitorSlug: monitorConfig.slug,
          checkInId,
        });

        // Run the actual workflow
        const result = await this.workflow.run(
          event as WorkflowEvent<TParams>,
          step,
        );

        // Report success
        Sentry.captureCheckIn({
          checkInId,
          status: "ok",
          monitorSlug: monitorConfig.slug,
        });

        addBreadcrumb("Monitor check-in completed", {
          monitorSlug: monitorConfig.slug,
          status: "ok",
        });

        workerLogger.info("Monitor check-in completed successfully", {
          monitorSlug: monitorConfig.slug,
          checkInId,
        });

        return result;
      } catch (error) {
        // Report failure
        if (checkInId) {
          Sentry.captureCheckIn({
            checkInId,
            status: "error",
            monitorSlug: monitorConfig.slug,
          });

          addBreadcrumb("Monitor check-in failed", {
            monitorSlug: monitorConfig.slug,
            status: "error",
          });

          workerLogger.error("Monitor check-in failed", {
            monitorSlug: monitorConfig.slug,
            checkInId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Capture the exception
        captureException(error, {
          workflow: monitorConfig.slug,
          checkInId,
        });

        // Re-throw to maintain workflow failure semantics
        throw error;
      }
    }
  };
}
