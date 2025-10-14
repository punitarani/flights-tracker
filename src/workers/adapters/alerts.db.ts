/**
 * Adapter for alerts-db to work in Cloudflare Worker environment
 * Wraps existing src/core/alerts-db.ts functions with worker DB instance
 */

import { and, eq, gte, isNull, or } from "drizzle-orm";
import { AlertType } from "@/core/alert-types";
import { alert } from "@/db/schema";
import { getWorkerDb } from "../db";
import type { WorkerEnv } from "../env";

export async function getUserIdsWithActiveDailyAlerts(
  env: WorkerEnv,
): Promise<string[]> {
  const db = getWorkerDb(env);
  const now = new Date().toISOString();

  const results = await db
    .select({ userId: alert.userId })
    .from(alert)
    .where(
      and(
        eq(alert.status, "active"),
        eq(alert.type, AlertType.DAILY),
        or(isNull(alert.alertEnd), gte(alert.alertEnd, now)),
      ),
    )
    .groupBy(alert.userId);

  return results.map((row) => row.userId);
}

/**
 * Checks if a user has active daily alerts
 */
export async function userHasActiveAlerts(
  env: WorkerEnv,
  userId: string,
): Promise<boolean> {
  const db = getWorkerDb(env);
  const now = new Date().toISOString();

  const result = await db
    .select({ count: alert.id })
    .from(alert)
    .where(
      and(
        eq(alert.userId, userId),
        eq(alert.status, "active"),
        eq(alert.type, AlertType.DAILY),
        or(isNull(alert.alertEnd), gte(alert.alertEnd, now)),
      ),
    )
    .limit(1);

  return result.length > 0;
}
