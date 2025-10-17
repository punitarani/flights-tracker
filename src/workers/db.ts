/**
 * Database utilities for Cloudflare Workers
 * Uses Hyperdrive for global connection pooling and optimized database access
 *
 * Hyperdrive provides:
 * - Global connection pooling across Cloudflare's network
 * - Reduced latency by eliminating connection setup overhead
 * - Automatic query routing and optimization
 *
 * Each workflow step execution may run in a different request context,
 * and I/O objects (like database connections) cannot be shared across contexts.
 * Creating a fresh connection per call ensures compatibility with Cloudflare's
 * execution model while Hyperdrive handles connection pooling globally.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import type { WorkerEnv } from "./env";

/**
 * Creates a new Drizzle database client configured for Cloudflare Workers with Hyperdrive.
 *
 * Hyperdrive configuration (per Cloudflare docs):
 * - Uses env.HYPERDRIVE.connectionString for globally pooled connections
 * - Fallback to env.DATABASE_URL for local development (without Hyperdrive)
 * - max: 5 connections (Cloudflare Workers limit on concurrent external connections)
 * - idle_timeout: 20 seconds (connections are short-lived in Workers)
 * - connect_timeout: 10 seconds (fail fast on connection issues)
 * - prepare: false (REQUIRED for Supabase Pgbouncer/Supavisor compatibility)
 * - fetch_types: true (default, REQUIRED because schema uses array types like text[])
 *
 * @param env - Worker environment variables containing HYPERDRIVE binding
 * @returns Drizzle database client instance with schema
 */
export function getWorkerDb(env: WorkerEnv) {
  // Use Hyperdrive connection string if available, fallback to direct connection for local dev
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

  const client = postgres(connectionString, {
    // Limit to 5 connections per Worker request due to Cloudflare's concurrent connection limits
    // Hyperdrive handles global connection pooling across Cloudflare's network
    max: 5,

    // Close idle connections after 20 seconds
    // Workers are short-lived and don't need long-lived connections
    idle_timeout: 20,

    // Timeout for establishing new connections
    connect_timeout: 10,

    // CRITICAL: Disable prepared statements for Supabase Pgbouncer/Supavisor compatibility
    // Supabase connection pooler in transaction mode doesn't support prepared statements
    prepare: false,

    // NOTE: fetch_types defaults to true and is REQUIRED for our schema
    // We use array types (e.g., flightNumbers: text[]) which need type fetching
    // Do NOT set fetch_types: false or array queries will fail
  });

  return drizzle({ client, schema });
}
