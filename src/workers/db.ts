/**
 * Database utilities for Cloudflare Workers
 * Adapts the main app's db client for worker environment
 *
 * IMPORTANT: This function creates a NEW database connection on each call
 * to avoid Cloudflare Workers' request context isolation issues.
 *
 * Each workflow step execution may run in a different request context,
 * and I/O objects (like database connections) cannot be shared across contexts.
 * Creating a fresh connection per call ensures compatibility with Cloudflare's
 * execution model while still benefiting from postgres-js internal connection pooling.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { WorkerEnv } from "./env";

/**
 * Creates a new Drizzle database client configured for Cloudflare Workers.
 *
 * Configuration optimized for Supabase Pgbouncer:
 * - max: 1 connection per worker instance (Cloudflare Workers have limited concurrency)
 * - idle_timeout: 20 seconds (connections are short-lived in Workers)
 * - connect_timeout: 10 seconds (fail fast on connection issues)
 * - prepare: false (REQUIRED for Pgbouncer in transaction mode)
 *
 * @param env - Worker environment variables containing DATABASE_URL
 * @returns Drizzle database client instance with schema
 */
export function getWorkerDb(env: WorkerEnv) {
  const client = postgres(env.DATABASE_URL, {
    // Limit to 1 connection per worker instance
    // Workers have limited concurrency, and we create fresh clients per operation
    max: 1,

    // Close idle connections after 20 seconds
    // Workers are short-lived and don't need long-lived connections
    idle_timeout: 20,

    // Timeout for establishing new connections
    connect_timeout: 10,

    // CRITICAL: Disable prepared statements for Pgbouncer compatibility
    // Pgbouncer in transaction mode doesn't support prepared statements
    prepare: false,

    // Disable SSL verification in development, required for production
    // Supabase uses SSL by default, let connection string control this
    // ssl: env.ENVIRONMENT === 'production' ? 'require' : false,
  });

  return drizzle({ client, schema });
}
