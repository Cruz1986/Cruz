import { describe, expect, it } from "vitest";
import { clientKey, rateLimiter } from "@/lib/security/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit per window, then asks to retry later", () => {
    const limiter = rateLimiter({ limit: 3, windowMs: 60_000 });
    expect([1, 2, 3].map(() => limiter.check("a", 1000).ok)).toEqual([true, true, true]);
    expect(limiter.check("a", 1000)).toEqual({ ok: false, retryAfter: 60 });
    expect(limiter.check("b", 1000).ok).toBe(true);
    expect(limiter.check("a", 61_000).ok).toBe(true);
  });

  it("keeps memory bounded", () => {
    const limiter = rateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0);
    expect(limiter.check("c", 0).ok).toBe(false);
    expect(limiter.check("a", 0).ok).toBe(true); // "a" was dropped to make room
  });

  it("reads the visitor's address from the proxy headers", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientKey(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
