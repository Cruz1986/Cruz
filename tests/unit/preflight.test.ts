import { describe, expect, it } from "vitest";
import { checkEnvironment, summarize, supabaseKeyKind, type Env } from "@/lib/deploy/preflight";

const jwt = (role: string) =>
  ["e30", Buffer.from(JSON.stringify({ role })).toString("base64url"), "signature"].join(".");
// A valid key pair shape: 65-byte uncompressed P-256 public key, 32-byte private key.
const VAPID_PUBLIC = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");
const VAPID_PRIVATE = Buffer.alloc(32, 2).toString("base64url");

const GOOD: Env = {
  NEXT_PUBLIC_SITE_URL: "https://bible.example.org",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_xyz",
  CRON_SECRET: "a".repeat(64),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: VAPID_PUBLIC,
  VAPID_PRIVATE_KEY: VAPID_PRIVATE,
  VAPID_SUBJECT: "mailto:office@parish.example.org",
};

const statusOf = (env: Env, name: string) => checkEnvironment(env).find((c) => c.name === name)?.status;

describe("production environment check", () => {
  it("passes a complete configuration", () => {
    expect(summarize(checkEnvironment(GOOD))).toEqual({ failed: 0, warned: 0 });
  });

  it("recognises Supabase key kinds", () => {
    expect(supabaseKeyKind("sb_publishable_x")).toBe("publishable");
    expect(supabaseKeyKind("sb_secret_x")).toBe("secret");
    expect(supabaseKeyKind(jwt("anon"))).toBe("publishable");
    expect(supabaseKeyKind(jwt("service_role"))).toBe("secret");
    expect(supabaseKeyKind("nonsense")).toBe("unknown");
  });

  it("refuses a secret key where the browser would see it", () => {
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") }, "Publishable key")).toBe(
      "fail",
    );
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_EXTRA: GOOD.CRON_SECRET }, "Browser variables")).toBe("fail");
    expect(statusOf({ ...GOOD, SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" }, "Service role key")).toBe("fail");
  });

  it("requires https addresses", () => {
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_SITE_URL: "http://bible.example.org" }, "Site URL")).toBe("fail");
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_SITE_URL: "https://localhost:3000" }, "Site URL")).toBe("fail");
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_SITE_URL: "https://x.org/app" }, "Site URL")).toBe("fail");
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_SUPABASE_URL: "" }, "Supabase URL")).toBe("fail");
  });

  it("checks the reminder settings", () => {
    expect(statusOf({ ...GOOD, CRON_SECRET: "short" }, "Cron secret")).toBe("fail");
    expect(statusOf({ ...GOOD, VAPID_PRIVATE_KEY: "" }, "Push keys")).toBe("fail");
    expect(statusOf({ ...GOOD, NEXT_PUBLIC_VAPID_PUBLIC_KEY: "abc" }, "Push keys")).toBe("fail");
    expect(statusOf({ ...GOOD, VAPID_SUBJECT: "admin" }, "Push keys")).toBe("fail");
    expect(statusOf({ ...GOOD, VAPID_SUBJECT: "mailto:admin@example.com" }, "Push keys")).toBe("warn");
    expect(statusOf({ ...GOOD, NOTIFICATION_PROVIDER: "log" }, "Notification provider")).toBe("fail");
  });

  it("allows launching without reminders, with warnings", () => {
    const env = { ...GOOD };
    for (const k of ["SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"])
      delete env[k];
    expect(summarize(checkEnvironment(env))).toEqual({ failed: 0, warned: 2 });
  });
});
