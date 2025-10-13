/**
 * Database utilities for Cloudflare Workers
 * Adapts the main app's db client for worker environment
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { WorkerEnv } from "./env";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getWorkerDb(env: WorkerEnv) {
  if (!dbInstance) {
    const client = postgres(env.DATABASE_URL);
    dbInstance = drizzle({ client });
  }
  return dbInstance;
}
