import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

/**
 * Anonymous client for published content. Reads no cookies, so pages using it stay
 * static / incrementally regenerated. Returns null when Supabase is not configured.
 */
export function createPublicClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type DbClient = NonNullable<ReturnType<typeof createPublicClient>>;
