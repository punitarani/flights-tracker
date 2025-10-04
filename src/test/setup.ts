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
