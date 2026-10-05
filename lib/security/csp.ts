/**
 * Content Security Policy. Scripts allow 'unsafe-inline' because statically generated pages cannot carry a
 * per-request nonce (Next.js inlines its bootstrap data); the app renders no user-supplied HTML, and every
 * other source is limited to this site and the Supabase project.
 */
export function contentSecurityPolicy({
  supabaseUrl,
  dev,
  https = false,
}: {
  supabaseUrl?: string;
  dev: boolean;
  /** Served over HTTPS: browsers upgrade any http:// request. */
  https?: boolean;
}): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const realtime = supabase ? supabase.replace(/^http/, "ws") : "";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabase, realtime],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Sign-in posts here and is redirected to Supabase Auth and, for Google, to Google's consent page.
    "form-action": ["'self'", supabase, "https://accounts.google.com"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`)
    .join("; ");
  return https ? `${policy}; upgrade-insecure-requests` : policy;
}
