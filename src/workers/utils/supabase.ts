import { createClient } from "@supabase/supabase-js";
import type { WorkerEnv } from "../env";

export function createSupabaseServiceClient(env: WorkerEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
