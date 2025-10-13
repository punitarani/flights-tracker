/**
 * Test setup for worker tests
 * Provides mocks and utilities for testing workers without Cloudflare runtime dependencies
 */

import type { WorkerEnv } from "../env";

/**
 * Type definitions for mock Cloudflare bindings
 */

/** Mock workflow instance returned by workflow.create() */
interface MockWorkflowInstance<T = Record<string, never>> {
  id: string;
  params: T;
  status: () => Promise<{ status: string }>;
}

/** Mock workflow binding interface */
interface MockWorkflowBinding<T = Record<string, never>> {
  create: (options: {
    id: string;
    params: T;
  }) => Promise<MockWorkflowInstance<T>>;
  get: (id: string) => Promise<MockWorkflowInstance<T> | undefined>;
}

/** Mock queue message body */
interface QueueMessageBody {
  userId: string;
}

/** Mock queue batch message */
interface MockQueueBatchMessage {
  body: QueueMessageBody;
}

/** Mock queue binding interface */
interface MockQueueBinding {
  send: (body: QueueMessageBody) => Promise<void>;
  sendBatch: (batch: MockQueueBatchMessage[]) => Promise<void>;
  getMessages: () => QueueMessageBody[];
  clear: () => void;
}

/**
 * Creates a mock worker environment with all required bindings
 * @param overrides - Optional partial overrides for environment variables
 * @returns Complete mock WorkerEnv instance
 */
export const createMockEnv = (overrides?: Partial<WorkerEnv>): WorkerEnv => ({
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "test@example.com",
  SEATS_AERO_API_KEY: "test_seats_key",
  NEXTJS_API_URL: "http://localhost:3000",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test_service_role_key",
  SENTRY_DSN: "test_sentry_dsn",
  SENTRY_ENVIRONMENT: "test",
  CHECK_ALERTS_WORKFLOW: createMockWorkflow() as unknown as Workflow,
  PROCESS_ALERTS_WORKFLOW: createMockWorkflow() as unknown as Workflow,
  ALERTS_QUEUE: createMockQueue() as unknown as Queue<QueueMessageBody>,
  ...overrides,
});

/**
 * Creates a mock Cloudflare Workflow binding for testing
 * Stores workflow instances in memory for test inspection
 */
export const createMockWorkflow = <
  T = Record<string, never>,
>(): MockWorkflowBinding<T> => {
  const instances = new Map<string, MockWorkflowInstance<T>>();

  return {
    create: async ({ id, params }: { id: string; params: T }) => {
      const instance: MockWorkflowInstance<T> = {
        id,
        params,
        status: async () => ({ status: "running" }),
      };
      instances.set(id, instance);
      return instance;
    },
    get: async (id: string) => instances.get(id),
  };
};

/**
 * Creates a mock Cloudflare Queue binding for testing
 * Stores messages in memory for test inspection
 */
export const createMockQueue = (): MockQueueBinding => {
  const messages: QueueMessageBody[] = [];

  return {
    send: async (body: QueueMessageBody) => {
      messages.push(body);
    },
    sendBatch: async (batch: MockQueueBatchMessage[]) => {
      messages.push(...batch.map((m) => m.body));
    },
    getMessages: () => messages,
    clear: () => {
      messages.length = 0;
    },
  };
};

/**
 * Creates a mock ExecutionContext for Cloudflare Workers
 */
export const createMockExecutionContext = (): ExecutionContext =>
  ({
    props: {},
    waitUntil: (promise: Promise<unknown>) => promise,
    passThroughOnException: () => {},
  }) as ExecutionContext;

/**
 * Creates a mock ScheduledController for cron trigger testing
 */
export const createMockScheduledController = (
  cron = "0 */6 * * *",
  scheduledTime = Date.now(),
): ScheduledController =>
  ({
    scheduledTime,
    cron,
  }) as ScheduledController;

/**
 * Creates a mock queue message for testing queue handlers
 */
export const createMockQueueMessage = (userId: string) => ({
  id: `msg-${Date.now()}`,
  timestamp: new Date(),
  body: { userId },
  ack: () => {},
  retry: () => {},
});

/**
 * Creates a mock queue batch for testing batch message processing
 * @param userIds - Array of user IDs to create messages for
 */
export const createMockQueueBatch = (
  userIds: string[],
): MessageBatch<{ userId: string }> =>
  ({
    queue: "flights-tracker-alerts-queue",
    retryAll: () => {},
    ackAll: () => {},
    messages: userIds.map((userId) =>
      createMockQueueMessage(userId),
    ) as Message<{ userId: string }>[],
  }) as MessageBatch<{ userId: string }>;

/**
 * Creates a mock fetch Response for testing HTTP calls
 * @param data - Response data to return
 * @param status - HTTP status code (default: 200)
 * @param ok - Whether the response is successful (default: true)
 */
export const mockFetchResponse = <T>(
  data: T,
  status = 200,
  ok = true,
): Response =>
  ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as Response;

/**
 * Mocks console output for testing logger behavior
 * Captures log, warn, and error messages for inspection
 * @returns Object with captured messages and restore/clear utilities
 */
export const mockConsole = () => {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  console.log = (message: string) => logs.push(message);
  console.warn = (message: string) => warnings.push(message);
  console.error = (message: string) => errors.push(message);

  return {
    logs,
    warnings,
    errors,
    restore: () => {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    },
    clear: () => {
      logs.length = 0;
      warnings.length = 0;
      errors.length = 0;
    },
  };
};
