import { afterEach, mock } from "bun:test";
import { GlobalWindow } from "happy-dom";

// Set up DOM environment for all tests
const window = new GlobalWindow();
const document = window.document;
global.window = window as unknown as Window & typeof globalThis;
global.document = document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.HTMLInputElement = window.HTMLInputElement;
global.Element = window.Element;
global.Event = window.Event;
global.KeyboardEvent = window.KeyboardEvent;

process.env.WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ?? "test-webhook-secret";

mock.module("@/env", () => ({
  env: {
    DATABASE_URL: "mock://test-database-url-for-testing",
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,

    // External Services
    SEATS_AERO_API_KEY: "test-seats-aero-api-key",

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

mock.module("@/db/client", () => ({
  db: {
    select: mock(),
    insert: mock(),
    update: mock(),
    delete: mock(),
    execute: mock(),
    transaction: mock(
      async (
        callback: (tx: { execute: ReturnType<typeof mock> }) => unknown,
      ) => {
        const txExecute = mock();
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
  mock.restore();
});

Object.assign(globalThis, {
  console: {
    ...console,
    log: mock(),
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
  },
});
