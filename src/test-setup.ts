import { vi } from "vitest";

// Mock environment variables
vi.mock("@/env", () => ({
  env: {
    DATABASE_URL: "mock://test-database-url-for-testing",
  },
}));

// Mock the database client
vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Set up global test environment
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
