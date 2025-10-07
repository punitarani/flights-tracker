import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export function createServiceClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
