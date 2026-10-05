/**
 * Public configuration. NEXT_PUBLIC_* values are inlined at build time, so they
 * must be referenced literally (no dynamic process.env lookups).
 * Server-only secrets (e.g. a service role key) must never be added here.
 */

export type SupabaseConfig = { url: string; publishableKey: string };

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isAuthConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
