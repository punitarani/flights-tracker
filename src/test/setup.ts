import { afterEach, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    DATABASE_URL: "mock://test-database-url-for-testing",
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

class ResizeObserverMock {
  // biome-ignore lint/suspicious/noExplicitAny: test environment mock
  callback: any;

  // biome-ignore lint/complexity/noUselessConstructor: storing callback for parity
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  // biome-ignore lint/complexity/noUselessConstructor: parity with real observer
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  // biome-ignore lint/style/noNonNullAssertion: assigning mock for tests
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
