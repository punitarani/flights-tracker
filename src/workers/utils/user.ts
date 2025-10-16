import type { WorkerEnv } from "../env";
import { workerLogger } from "./logger";
import { createSupabaseServiceClient } from "./supabase";

export async function getUserEmail(
  env: WorkerEnv,
  userId: string,
  getClient = createSupabaseServiceClient,
): Promise<string | null> {
  try {
    const supabase = getClient(env);
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      workerLogger.error("Failed to fetch user from Supabase", {
        userId,
        error: error.message,
      });
      return null;
    }

    return data.user?.email ?? null;
  } catch (error) {
    workerLogger.error("Error fetching user email", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
