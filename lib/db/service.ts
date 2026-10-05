import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

/**
 * Service-role client for scheduled jobs (sending reminders). It bypasses row level security, so it is
 * used only in server code that never takes user input, and the key lives only in server env.
 */
export function createServiceClient() {
  const config = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) return null;
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
