"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

let client: SupabaseClient | null | undefined;

/**
 * The signed-in reader's client in the browser (session from the auth cookies). Used only for the
 * reader's own personal data, which row level security limits to its owner. Null when not configured.
 */
export function getBrowserClient(): SupabaseClient | null {
  if (client === undefined) {
    const config = getSupabaseConfig();
    client = config ? createBrowserClient(config.url, config.publishableKey) : null;
  }
  return client;
}

export type BrowserClient = SupabaseClient;
