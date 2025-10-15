import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";

// Create the underlying Drizzle instance once
const client = postgres(env.DATABASE_URL);
const innerDb = drizzle({ client });

// Export a plain, mutable wrapper so tests can replace methods (via bun:test mocks)
// This avoids issues where Drizzle's proxied instance cannot be monkey-patched.
// Only the methods used in the codebase are exposed here.
export const db = {
  select: (...args: unknown[]) => (innerDb as unknown as any).select(...args),
  insert: (...args: unknown[]) => (innerDb as unknown as any).insert(...args),
  update: (...args: unknown[]) => (innerDb as unknown as any).update(...args),
  delete: (...args: unknown[]) => (innerDb as unknown as any).delete(...args),
  execute: (...args: unknown[]) => (innerDb as unknown as any).execute?.(...args),
  transaction: (fn: unknown) => (innerDb as unknown as any).transaction(fn),
} as Record<string, unknown> as {
  select: (...args: unknown[]) => unknown;
  insert: (...args: unknown[]) => unknown;
  update: (...args: unknown[]) => unknown;
  delete: (...args: unknown[]) => unknown;
  execute: (...args: unknown[]) => unknown;
  transaction: (fn: unknown) => unknown;
};
