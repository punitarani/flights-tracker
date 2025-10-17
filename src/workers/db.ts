/**
 * Database utilities for Cloudflare Workers
 * Provides optimized database client for worker environment
 *
 * IMPORTANT: Each call creates a new postgres client but Drizzle instances
 * are cached per worker context. This ensures proper connection pooling
 * while respecting Cloudflare Workers' execution model.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { WorkerEnv } from "./env";

// Cache for postgres clients per DATABASE_URL
const clientCache = new Map<string, postgres.Sql>();

/**
 * Creates or retrieves a cached Drizzle database client for Cloudflare Workers.
 *
 * Configuration optimized for Supabase Pgbouncer:
 * - max: 1 connection (Cloudflare Workers have limited concurrency)
 * - idle_timeout: 20 seconds (short-lived connections)
 * - connect_timeout: 10 seconds (fail fast)
 * - prepare: false (REQUIRED for Pgbouncer transaction mode)
 * - transform: undefined (disable type parsing for better performance)
 *
 * @param env - Worker environment variables containing DATABASE_URL
 * @returns Drizzle database client instance
 */
export function getWorkerDb(env: WorkerEnv) {
  const dbUrl = env.DATABASE_URL;
  
  // Check cache first
  let client = clientCache.get(dbUrl);
  
  if (!client) {
    // Create new client with optimized settings
    client = postgres(dbUrl, {
      // Cloudflare Workers specific settings
      max: 1, // Single connection per worker
      idle_timeout: 20, // Close idle connections quickly
      connect_timeout: 10, // Fail fast on connection issues
      
      // CRITICAL: Disable prepared statements for Pgbouncer
      prepare: false,
      
      // Performance optimizations
      transform: undefined, // Disable type parsing for better perf
      
      // Connection settings
      keep_alive: 5, // Keep connection alive
      connection: {
        application_name: "flights-tracker-worker",
      },
    });
    
    // Cache the client
    clientCache.set(dbUrl, client);
  }

  return drizzle({ client });
}

/**
 * Closes all database connections and clears the cache.
 * Useful for cleanup in tests or graceful shutdown.
 */
export async function closeAllConnections(): Promise<void> {
  const clients = Array.from(clientCache.values());
  clientCache.clear();
  
  await Promise.all(clients.map(client => client.end()));
}
