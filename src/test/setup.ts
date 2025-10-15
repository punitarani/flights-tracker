import { mock } from "bun:test";
import { GlobalWindow } from "happy-dom";

// Indicate we're in a test environment
process.env.NODE_ENV = process.env.NODE_ENV || "test";

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

// Mock environment variables to avoid @t3-oss/env-nextjs blocking server vars
// when happy-dom sets up global.window (making it think we're on client-side)
mock.module("@/env", () => ({
  env: {
    DATABASE_URL: "mock://test-database-url-for-testing",
    SUPABASE_SECRET_KEY: "test-supabase-secret-key",
    RESEND_API_KEY: "test-resend-api-key",
    RESEND_FROM_EMAIL: "Flight Alerts <alerts@resend.dev>",
    SEATS_AERO_API_KEY: "test-seats-aero-api-key",
    WORKER_URL: "https://test-worker.example.com",
    WORKER_API_KEY: "test-worker-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-supabase-publishable-key",
    NEXT_PUBLIC_MAPKIT_TOKEN: "test-mapkit-token",

    // Disable proxy in test environment to prevent network issues
    PROXY_ENABLED: false,
    PROXY_HOST: undefined,
    PROXY_PORT: undefined,
    PROXY_USERNAME: undefined,
    PROXY_PASSWORD: undefined,
    PROXY_PROTOCOL: "http",
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
