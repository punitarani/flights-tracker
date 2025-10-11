import { afterEach, vi } from "vitest";

process.env.WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ?? "test-webhook-secret";

vi.mock("@/env", () => ({
  env: {
    DATABASE_URL: "mock://test-database-url-for-testing",
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,

    // Use real proxy configuration if available, otherwise disabled
    PROXY_ENABLED: process.env.PROXY_ENABLED === "true",
    PROXY_HOST: process.env.PROXY_HOST,
    PROXY_PORT: process.env.PROXY_PORT
      ? parseInt(process.env.PROXY_PORT, 10)
      : undefined,
    PROXY_USERNAME: process.env.PROXY_USERNAME,
    PROXY_PASSWORD: process.env.PROXY_PASSWORD,
    PROXY_PROTOCOL: process.env.PROXY_PROTOCOL || "http",
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(
      async (
        callback: (tx: { execute: ReturnType<typeof vi.fn> }) => unknown,
      ) => {
        const txExecute = vi.fn();
        return await callback({ execute: txExecute });
      },
    ),
  },
}));

class ResizeObserverMock {
  // biome-ignore lint/suspicious/noExplicitAny: test environment mock
  callback: any;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

Object.assign(globalThis, {
  console: {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});
