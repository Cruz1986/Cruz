/**
 * A small fixed-window rate limiter (per server instance). It keeps one visitor from monopolising the
 * search endpoints; it is not a substitute for the hosting platform's DDoS protection.
 */
export type RateLimiter = { check(key: string, now?: number): { ok: boolean; retryAfter: number } };

export function rateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const hits = new Map<string, { start: number; count: number }>();
  return {
    check(key, now = Date.now()) {
      let entry = hits.get(key);
      if (!entry || now - entry.start >= windowMs) {
        if (!entry && hits.size >= maxKeys) {
          // Forget expired windows first; if still full, the oldest visitor.
          for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value!);
        }
        entry = { start: now, count: 0 };
        hits.set(key, entry);
      }
      entry.count += 1;
      const ok = entry.count <= limit;
      return { ok, retryAfter: ok ? 0 : Math.ceil((entry.start + windowMs - now) / 1000) };
    },
  };
}

/** The visitor's address as the hosting proxy reports it. */
export function clientKey(headers: Headers): string {
  return (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "unknown").trim();
}
