import { NextResponse } from "next/server";
import { clientKey, rateLimiter } from "@/lib/security/rate-limit";

/** JSON helpers for the public API (PRD §15). */
export function json(data: unknown, { maxAge = 0 }: { maxAge?: number } = {}) {
  return NextResponse.json(data, {
    headers: maxAge ? { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 24}` } : {},
  });
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const searchLimiter = rateLimiter({ limit: 60, windowMs: 60_000 });

/** 429 when one visitor sends more than 60 searches a minute (per server instance); null otherwise. */
export function limitSearch(request: Request): NextResponse | null {
  const { ok, retryAfter } = searchLimiter.check(clientKey(request.headers));
  if (ok) return null;
  const response = apiError(429, "too_many_requests", "Too many searches. Try again shortly.");
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}
