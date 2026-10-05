import { type NextRequest, type NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/env";

/**
 * Refreshes the Supabase session cookies on `response` and returns whether the request
 * carries a valid session. Only verifies the JWT (no database access): an optimistic check.
 */
export async function refreshSession(request: NextRequest, response: NextResponse): Promise<boolean> {
  const config = getSupabaseConfig();
  if (!config) return false;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}
