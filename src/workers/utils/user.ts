/**
 * Supabase utilities for Cloudflare Workers
 * Fetches user information from Supabase Auth API
 */

import type { WorkerEnv } from "../env";
import { workerLogger } from "./logger";

export async function getUserEmail(
  env: WorkerEnv,
  userId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      workerLogger.error("Failed to fetch user from Supabase", {
        userId,
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as { email?: string };
    return data.email || null;
  } catch (error) {
    workerLogger.error("Error fetching user email", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
