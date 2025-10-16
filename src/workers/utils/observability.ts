/**
 * Comprehensive observability utilities for Cloudflare Workers
 * Provides structured logging, tracing, and error tracking
 */

import * as Sentry from "@sentry/cloudflare";
import type { WorkerEnv } from "../env";

// Enhanced context type for better tracing
export interface ObservabilityContext {
  workflow?: string;
  step?: string;
  userId?: string;
  searchRequestId?: string;
  instanceId?: string;
  route?: string;
  [key: string]: unknown;
}

// Enhanced error context
export interface ErrorContext extends ObservabilityContext {
  level?: "error" | "warning" | "info";
  retryable?: boolean;
  component?: string;
}

/**
 * Enhanced Sentry configuration with better tracing
 */
export function getSentryOptions(env: WorkerEnv) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: 1.0,
    enableLogs: true,
    // Enhanced performance monitoring
    enableTracing: true,
    // Better error grouping
    // biome-ignore lint/suspicious/noExplicitAny: Sentry beforeSend requires complex event types
    beforeSend(event: any, _hint: any) {
      // Add worker-specific context
      if (event.tags) {
        event.tags = {
          ...event.tags,
          platform: "cloudflare-workers",
          component: (event.tags?.component as string) || "unknown",
        };
      }
      return event;
    },
  };
}

/**
 * Enhanced error capture with better context
 */
export function captureException(error: unknown, context?: ErrorContext) {
  Sentry.withScope((scope) => {
    if (context) {
      // Set user context
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }

      // Set tags for better filtering
      if (context.workflow) scope.setTag("workflow", context.workflow);
      if (context.step) scope.setTag("step", context.step);
      if (context.component) scope.setTag("component", context.component);
      if (context.retryable !== undefined)
        scope.setTag("retryable", context.retryable);

      // Set context for detailed debugging
      scope.setContext("observability", context);
    }

    // Set level if provided
    if (context?.level) {
      scope.setLevel(context.level);
    }

    Sentry.captureException(error);
  });
}

/**
 * Enhanced message capture with context
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: ObservabilityContext,
) {
  Sentry.withScope((scope) => {
    if (context) {
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      if (context.workflow) scope.setTag("workflow", context.workflow);
      if (context.step) scope.setTag("step", context.step);
      scope.setContext("observability", context);
    }
    scope.setLevel(level);
    Sentry.captureMessage(message, level);
  });
}

/**
 * Enhanced breadcrumb with better structure
 */
export function addBreadcrumb(
  message: string,
  data?: ObservabilityContext,
  category: string = "default",
) {
  Sentry.addBreadcrumb({
    message,
    data,
    category,
    timestamp: Date.now() / 1000,
    level: data?.level === "error" ? "error" : "info",
  });
}

/**
 * Set user context for tracing
 */
export function setUser(
  userId: string,
  additionalContext?: Record<string, unknown>,
) {
  Sentry.setUser({
    id: userId,
    ...additionalContext,
  });
}

/**
 * Set tags for better filtering and grouping
 */
export function setTag(key: string, value: string | number) {
  Sentry.setTag(key, value);
}

/**
 * Set multiple tags at once
 */
export function setTags(tags: Record<string, string | number>) {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Start a transaction for performance monitoring
 * Note: Simplified for Cloudflare Workers compatibility
 */
export function startTransaction(name: string, context?: ObservabilityContext) {
  // Add breadcrumb for transaction start
  addBreadcrumb(`Starting transaction: ${name}`, context, "transaction");

  return {
    setStatus: (status: { code: number; message: string }) => {
      addBreadcrumb(
        `Transaction status: ${status.message}`,
        {
          ...context,
          status: status.message,
          code: status.code,
        },
        "transaction",
      );
    },
    end: () => {
      addBreadcrumb(`Ending transaction: ${name}`, context, "transaction");
    },
    setAttributes: (attrs: Record<string, unknown>) => {
      addBreadcrumb(
        `Transaction attributes updated`,
        {
          ...context,
          ...attrs,
        },
        "transaction",
      );
    },
  };
}

/**
 * Enhanced workflow step wrapper with comprehensive tracing
 */
export function withStepTracing<T>(
  stepName: string,
  context: ObservabilityContext,
  operation: () => Promise<T>,
): Promise<T> {
  const span = startTransaction(`workflow.step.${stepName}`, context);

  return Sentry.withScope((scope) => {
    // Set step-specific context
    scope.setTag("step", stepName);
    scope.setContext("step_context", context);

    addBreadcrumb(`Starting step: ${stepName}`, context, "workflow");

    return operation()
      .then((result) => {
        addBreadcrumb(
          `Completed step: ${stepName}`,
          { ...context, success: true },
          "workflow",
        );
        span.setStatus({ code: 1, message: "ok" }); // 1 = OK
        return result;
      })
      .catch((error) => {
        addBreadcrumb(
          `Failed step: ${stepName}`,
          { ...context, error: error.message },
          "workflow",
        );
        span.setStatus({ code: 2, message: "internal_error" }); // 2 = Internal Error
        captureException(error, {
          ...context,
          step: stepName,
          component: "workflow",
        });
        throw error;
      })
      .finally(() => {
        span.end();
      });
  });
}

/**
 * Workflow lifecycle tracing
 */
export function traceWorkflowLifecycle(
  workflowName: string,
  instanceId: string,
  context?: ObservabilityContext,
) {
  const workflowContext = {
    ...context,
    workflow: workflowName,
    instanceId,
  };

  return {
    start: () => {
      addBreadcrumb(
        `Starting workflow: ${workflowName}`,
        workflowContext,
        "workflow",
      );
      setTags({
        workflow: workflowName,
        instanceId,
      });
    },

    complete: (result?: unknown) => {
      addBreadcrumb(
        `Completed workflow: ${workflowName}`,
        {
          ...workflowContext,
          success: true,
          result: result ? "completed" : undefined,
        },
        "workflow",
      );
    },

    fail: (error: unknown) => {
      addBreadcrumb(
        `Failed workflow: ${workflowName}`,
        {
          ...workflowContext,
          error: error instanceof Error ? error.message : String(error),
        },
        "workflow",
      );
      captureException(error, { ...workflowContext, component: "workflow" });
    },
  };
}

// Re-export Sentry for advanced usage
export { Sentry };
