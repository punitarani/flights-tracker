/**
 * Sentry utilities for Cloudflare Workers
 * Uses @sentry/cloudflare with withSentry wrapper in index.ts
 */

import type { ExecutionContext } from "@cloudflare/workers-types";
import { trace } from "@opentelemetry/api";
import type { CloudflareOptions } from "@sentry/cloudflare";
import * as Sentry from "@sentry/cloudflare";
import {
  CloudflareClient,
  getDefaultIntegrations,
  setAsyncLocalStorageAsyncContextStrategy,
} from "@sentry/cloudflare";
import {
  basename,
  createStackParser,
  createTransport,
  getIntegrationsToSetup,
  initAndBind,
  nodeStackLineParser,
  SENTRY_BUFFER_FULL_ERROR,
  stackParserFromStackParserOptions,
  startInactiveSpan,
  startSpanManual,
  suppressTracing,
} from "@sentry/core";
import type { WorkerEnv } from "../env";

type WorkflowTransportResponse = {
  statusCode?: number;
  headers?: {
    [key: string]: string | null;
    "x-sentry-rate-limits": string | null;
    "retry-after": string | null;
  };
};

type StartSpanOptions = Parameters<typeof startSpanManual>[0];

export function getSentryOptions(env: WorkerEnv) {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: 1.0,
    enableLogs: true,
  };
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("additional", context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
) {
  Sentry.captureMessage(message, level);
}

export function setUser(userId: string) {
  Sentry.setUser({ id: userId });
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}

export function setTag(key: string, value: string | number) {
  Sentry.setTag(key, value);
}

// Re-export for convenience
export { Sentry };

let workflowSentryInitialized = false;
let workflowSentryConfigKey: string | undefined;

function getWorkflowConfigKey(env: WorkerEnv) {
  return `${env.SENTRY_DSN ?? ""}|${env.SENTRY_ENVIRONMENT ?? ""}`;
}

const DEFAULT_TRANSPORT_BUFFER_SIZE = 30;

class IsolatedPromiseBuffer {
  public readonly $: Array<PromiseLike<WorkflowTransportResponse>> = [];
  private readonly size: number;
  private readonly taskProducers: Array<
    () => PromiseLike<WorkflowTransportResponse>
  > = [];

  constructor(bufferSize = DEFAULT_TRANSPORT_BUFFER_SIZE) {
    this.size = bufferSize;
  }

  add(taskProducer: () => PromiseLike<WorkflowTransportResponse>) {
    if (this.taskProducers.length >= this.size) {
      return Promise.reject(SENTRY_BUFFER_FULL_ERROR);
    }

    this.taskProducers.push(taskProducer);
    return Promise.resolve({} as WorkflowTransportResponse);
  }

  drain(timeout?: number) {
    const pendingTasks = [...this.taskProducers];
    this.taskProducers.length = 0;

    return new Promise<boolean>((resolve) => {
      const timer = timeout
        ? setTimeout(() => {
            resolve(false);
          }, timeout)
        : undefined;

      void Promise.all(
        pendingTasks.map((producer) =>
          Promise.resolve(producer()).catch(() => {
            // Ignore transport errors during drain; they'll be handled by Sentry's retry logic
          }),
        ),
      ).then(() => {
        if (timer) {
          clearTimeout(timer);
        }
        resolve(true);
      });
    });
  }
}

function makeCloudflareTransport(options: unknown) {
  const transportOptions = options as {
    url: string;
    headers?: HeadersInit;
    fetchOptions?: RequestInit;
    bufferSize?: number;
    recordDroppedEvent: (...args: unknown[]) => void;
    tunnel?: string;
  };

  function makeRequest(request: {
    body: string | Uint8Array<ArrayBufferLike>;
  }): Promise<WorkflowTransportResponse> {
    const transportHeaders =
      "headers" in transportOptions ? transportOptions.headers : undefined;
    const transportFetchOptions =
      "fetchOptions" in transportOptions
        ? transportOptions.fetchOptions
        : undefined;
    const body = request.body as BodyInit;
    const requestOptions: RequestInit = {
      body,
      method: "POST",
      ...(transportFetchOptions ?? {}),
    };

    if (transportHeaders) {
      requestOptions.headers = transportHeaders;
    }

    return suppressTracing(() =>
      fetch(transportOptions.url, requestOptions).then(
        (response) =>
          ({
            statusCode: response.status,
            headers: {
              "x-sentry-rate-limits": response.headers.get(
                "X-Sentry-Rate-Limits",
              ),
              "retry-after": response.headers.get("Retry-After"),
            },
          }) satisfies WorkflowTransportResponse,
      ),
    );
  }

  return createTransport(
    transportOptions,
    makeRequest,
    new IsolatedPromiseBuffer(transportOptions.bufferSize),
  );
}

function makeFlushLock(ctx?: ExecutionContext) {
  if (!ctx) {
    return undefined;
  }

  let resolveAllDone: () => void = () => {};
  const allDone = new Promise<void>((resolve) => {
    resolveAllDone = resolve;
  });
  let pending = 0;
  const originalWaitUntil = ctx.waitUntil.bind(ctx);
  ctx.waitUntil = (promise) => {
    pending += 1;
    return originalWaitUntil(
      promise.finally(() => {
        pending -= 1;
        if (pending === 0) {
          resolveAllDone();
        }
      }),
    );
  };

  return {
    ready: allDone,
    finalize: () => {
      if (pending === 0) {
        resolveAllDone();
      }
      return allDone;
    },
  } as const;
}

class SentryCloudflareTracerProvider {
  private readonly tracers = new Map<string, SentryCloudflareTracer>();

  getTracer(name: string, version?: string, options?: { schemaUrl?: string }) {
    const key = `${name}@${version ?? ""}:${options?.schemaUrl ?? ""}`;
    const existing = this.tracers.get(key);
    if (existing) {
      return existing;
    }
    const tracer = new SentryCloudflareTracer();
    this.tracers.set(key, tracer);
    return tracer;
  }
}

class SentryCloudflareTracer {
  startSpan(name: string, options?: Parameters<typeof startInactiveSpan>[0]) {
    return startInactiveSpan({
      name,
      ...options,
      attributes: {
        ...options?.attributes,
        "sentry.cloudflare_tracer": true,
      },
    });
  }

  startActiveSpan<T>(
    name: string,
    options: Parameters<typeof startSpanManual>[0] | ((span: unknown) => T),
    context: unknown,
    callback?: (span: unknown) => T,
  ) {
    const baseOptions =
      typeof options === "object" && options !== null
        ? (options as StartSpanOptions)
        : undefined;
    const spanOptions = {
      ...(baseOptions ?? {}),
      name,
      attributes: {
        ...(baseOptions?.attributes ?? {}),
        "sentry.cloudflare_tracer": true,
      },
    } satisfies StartSpanOptions;
    const fn =
      typeof options === "function"
        ? options
        : typeof context === "function"
          ? context
          : (callback ?? (() => {}));

    return startSpanManual(spanOptions, fn as (span: unknown) => T);
  }
}

function setupOpenTelemetryTracer() {
  const tracerProvider = new SentryCloudflareTracerProvider();
  trace.setGlobalTracerProvider(
    tracerProvider as unknown as Parameters<
      typeof trace.setGlobalTracerProvider
    >[0],
  );
}

function workersStackLineParser(
  getModule: (filename?: string) => string | undefined,
): ReturnType<typeof nodeStackLineParser> {
  const [priority, parser] = nodeStackLineParser(getModule);

  const wrappedParser = (line: string) => {
    const frame = parser(line);
    if (frame) {
      const filename = frame.filename;
      frame.abs_path =
        filename && !filename.startsWith("/") ? `/${filename}` : filename;
      frame.in_app = filename !== undefined;
    }
    return frame;
  };

  return [priority, wrappedParser];
}

function getModuleName(filename?: string) {
  if (!filename) {
    return undefined;
  }
  return basename(filename, ".js");
}

const cloudflareStackParser = createStackParser(
  workersStackLineParser(getModuleName),
);

function initWorkflowClient(options: CloudflareOptions) {
  const normalizedOptions: CloudflareOptions = {
    ...options,
  };

  if (normalizedOptions.defaultIntegrations === undefined) {
    normalizedOptions.defaultIntegrations =
      getDefaultIntegrations(normalizedOptions);
  }

  const flushLock = makeFlushLock(
    (normalizedOptions as { ctx?: ExecutionContext }).ctx,
  );
  delete (normalizedOptions as { ctx?: ExecutionContext }).ctx;

  const clientOptions = {
    ...normalizedOptions,
    stackParser: stackParserFromStackParserOptions(
      normalizedOptions.stackParser || cloudflareStackParser,
    ),
    integrations: getIntegrationsToSetup(normalizedOptions),
    transport: normalizedOptions.transport || makeCloudflareTransport,
    flushLock,
  };

  if (!normalizedOptions.skipOpenTelemetrySetup) {
    setupOpenTelemetryTracer();
  }

  return initAndBind(CloudflareClient, clientOptions);
}

export function ensureWorkflowSentryInitialized(env: WorkerEnv) {
  const configKey = getWorkflowConfigKey(env);

  if (workflowSentryInitialized && workflowSentryConfigKey === configKey) {
    return;
  }

  const options = getSentryOptions(env);

  // Initialize Sentry only when a DSN is provided
  if (options.dsn) {
    setAsyncLocalStorageAsyncContextStrategy();

    if (!Sentry.isInitialized()) {
      initWorkflowClient({
        ...options,
        enableDedupe: false,
      });
    }
  }

  workflowSentryInitialized = true;
  workflowSentryConfigKey = configKey;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

async function deterministicTraceIdFromInstanceId(instanceId: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(instanceId),
  );
  return Array.from(new Uint8Array(buffer))
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createPropagationContext(instanceId: string) {
  const traceId = UUID_REGEX.test(instanceId)
    ? instanceId.replace(/-/g, "")
    : await deterministicTraceIdFromInstanceId(instanceId);

  const sampleRand = parseInt(traceId.slice(-4), 16) / 0xffff;

  return {
    traceId,
    sampleRand,
  };
}

interface WorkflowSentryOptions {
  workflow: string;
  instanceId: string;
}

export async function runWorkflowWithSentry<T>(
  env: WorkerEnv,
  options: WorkflowSentryOptions,
  callback: () => Promise<T>,
): Promise<T> {
  ensureWorkflowSentryInitialized(env);

  return Sentry.withScope(async (scope) => {
    scope.clear();

    scope.setTag("cloudflare.workflow.name", options.workflow);
    scope.setTag("cloudflare.workflow.instance_id", options.instanceId);
    scope.setContext("cloudflare.workflow", {
      name: options.workflow,
      instanceId: options.instanceId,
    });

    const propagationContext = await createPropagationContext(
      options.instanceId,
    );
    scope.setPropagationContext(propagationContext);

    try {
      return await callback();
    } finally {
      void Sentry.flush(2000).catch(() => {
        // Swallow flush failures to avoid interfering with workflow execution
      });
    }
  });
}
