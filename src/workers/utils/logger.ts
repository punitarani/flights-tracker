/**
 * Enhanced logger for Cloudflare Workers
 * Integrates with Sentry for comprehensive observability
 */

import type { ObservabilityContext } from "./observability";
import { addBreadcrumb, captureMessage } from "./observability";

type LogLevel = "info" | "warn" | "error" | "debug";

type LogAttributes = Record<string, unknown>;

interface LogContext extends ObservabilityContext {
  component?: string;
  operation?: string;
  duration?: number;
  retryCount?: number;
}

/**
 * Enhanced logging function with better structure and Sentry integration
 */
function log(
  level: LogLevel,
  message: string,
  data?: LogAttributes,
  context?: LogContext,
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    level,
    message,
    timestamp,
    component: context?.component || "worker",
    operation: context?.operation,
    ...data,
  };

  // Console output with structured JSON
  const serialized = JSON.stringify(logEntry);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else if (level === "debug") {
    console.debug(serialized);
  } else {
    console.log(serialized);
  }

  // Send to Sentry for observability
  try {
    // Add breadcrumb for tracing
    addBreadcrumb(message, { ...context, ...data }, "log");

    // Capture important messages
    if (level === "error" || level === "warn") {
      captureMessage(message, level === "warn" ? "warning" : level, context);
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "Failed to send log to Sentry",
        originalMessage: message,
        originalLevel: level,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * Enhanced worker logger with context support
 */
export const workerLogger = {
  info: (message: string, data?: LogAttributes, context?: LogContext) =>
    log("info", message, data, context),

  warn: (message: string, data?: LogAttributes, context?: LogContext) =>
    log("warn", message, data, context),

  error: (message: string, data?: LogAttributes, context?: LogContext) =>
    log("error", message, data, context),

  debug: (message: string, data?: LogAttributes, context?: LogContext) =>
    log("debug", message, data, context),

  // Workflow-specific logging
  workflow: {
    start: (workflowName: string, instanceId: string, context?: LogContext) => {
      log(
        "info",
        `Starting workflow: ${workflowName}`,
        { instanceId },
        {
          ...context,
          component: "workflow",
          operation: "start",
          workflow: workflowName,
        },
      );
    },

    complete: (
      workflowName: string,
      instanceId: string,
      result?: unknown,
      context?: LogContext,
    ) => {
      log(
        "info",
        `Completed workflow: ${workflowName}`,
        {
          instanceId,
          success: true,
          result: result ? "completed" : undefined,
        },
        {
          ...context,
          component: "workflow",
          operation: "complete",
          workflow: workflowName,
        },
      );
    },

    fail: (
      workflowName: string,
      instanceId: string,
      error: unknown,
      context?: LogContext,
    ) => {
      log(
        "error",
        `Failed workflow: ${workflowName}`,
        {
          instanceId,
          error: error instanceof Error ? error.message : String(error),
        },
        {
          ...context,
          component: "workflow",
          operation: "fail",
          workflow: workflowName,
        },
      );
    },
  },

  // Step-specific logging
  step: {
    start: (stepName: string, context?: LogContext) => {
      log(
        "info",
        `Starting step: ${stepName}`,
        {},
        {
          ...context,
          component: "workflow",
          operation: "step_start",
          step: stepName,
        },
      );
    },

    complete: (stepName: string, duration?: number, context?: LogContext) => {
      log(
        "info",
        `Completed step: ${stepName}`,
        { duration },
        {
          ...context,
          component: "workflow",
          operation: "step_complete",
          step: stepName,
          duration,
        },
      );
    },

    fail: (stepName: string, error: unknown, context?: LogContext) => {
      log(
        "error",
        `Failed step: ${stepName}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
        {
          ...context,
          component: "workflow",
          operation: "step_fail",
          step: stepName,
        },
      );
    },
  },

  // API-specific logging
  api: {
    request: (endpoint: string, method: string, context?: LogContext) => {
      log(
        "info",
        `API request: ${method} ${endpoint}`,
        { method, endpoint },
        {
          ...context,
          component: "api",
          operation: "request",
        },
      );
    },

    response: (
      endpoint: string,
      status: number,
      duration?: number,
      context?: LogContext,
    ) => {
      log(
        "info",
        `API response: ${status} ${endpoint}`,
        { status, duration },
        {
          ...context,
          component: "api",
          operation: "response",
          duration,
        },
      );
    },

    error: (endpoint: string, error: unknown, context?: LogContext) => {
      log(
        "error",
        `API error: ${endpoint}`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
        {
          ...context,
          component: "api",
          operation: "error",
        },
      );
    },
  },
};
