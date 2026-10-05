import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/security/csp";

describe("content security policy", () => {
  const prod = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", dev: false, https: true });

  it("limits sources to the site and the Supabase project", () => {
    expect(prod).toContain("default-src 'self'");
    expect(prod).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(prod).toContain("img-src 'self' data: blob: https://abc.supabase.co");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("form-action 'self' https://abc.supabase.co https://accounts.google.com");
    expect(prod).toMatch(/upgrade-insecure-requests$/);
  });

  it("never allows eval in production", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
  });

  it("works without Supabase, and over plain HTTP locally", () => {
    const local = contentSecurityPolicy({ dev: false });
    expect(local).toContain("connect-src 'self';");
    expect(local).not.toContain("upgrade-insecure-requests");
  });
});
