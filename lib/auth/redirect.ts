/**
 * Returns `input` only if it is a same-origin path (e.g. "/ta/admin?x=1"), otherwise
 * `fallback`. Prevents open redirects through ?next= parameters.
 */
export function safeNextPath(input: unknown, fallback: string): string {
  if (typeof input !== "string" || input.length === 0 || input.length > 2048) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  // Reject control characters and anything a URL parser would treat as a new origin.
  if (/[\u0000-\u001F\u007F]/.test(input)) return fallback;
  try {
    const url = new URL(input, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Login URL for a locale that returns the user to `next` afterwards. */
export function loginPath(locale: string, next?: string): string {
  const base = `/${locale}/login`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
