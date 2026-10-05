/**
 * Production readiness checks for the environment variables (pure, unit tested). The network checks — the
 * database's content and the live site — are in scripts/preflight.ts.
 */
export type CheckStatus = "pass" | "warn" | "fail";
export type Check = { name: string; status: CheckStatus; detail: string };
export type Env = Record<string, string | undefined>;

const pass = (name: string, detail: string): Check => ({ name, status: "pass", detail });
const warn = (name: string, detail: string): Check => ({ name, status: "warn", detail });
const fail = (name: string, detail: string): Check => ({ name, status: "fail", detail });

function base64UrlBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  return Uint8Array.from(Buffer.from(value, "base64url"));
}

/** The kind of Supabase API key: the new sb_publishable_/sb_secret_ keys, or a legacy JWT's role. */
export function supabaseKeyKind(key: string): "publishable" | "secret" | "unknown" {
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  const payload = key.split(".")[1];
  if (!payload) return "unknown";
  try {
    const role = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: unknown }).role;
    return role === "anon" ? "publishable" : role === "service_role" ? "secret" : "unknown";
  } catch {
    return "unknown";
  }
}

function httpsUrl(value: string | undefined): URL | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export function checkEnvironment(env: Env): Check[] {
  const checks: Check[] = [];
  const site = httpsUrl(env.NEXT_PUBLIC_SITE_URL);
  checks.push(
    site && site.pathname === "/"
      ? pass("Site URL", site.origin)
      : fail("Site URL", "NEXT_PUBLIC_SITE_URL must be the public https address, without a path"),
  );

  checks.push(
    httpsUrl(env.NEXT_PUBLIC_SUPABASE_URL)
      ? pass("Supabase URL", env.NEXT_PUBLIC_SUPABASE_URL!)
      : fail("Supabase URL", "NEXT_PUBLIC_SUPABASE_URL must be the project's https API URL"),
  );

  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const publishableKind = publishable ? supabaseKeyKind(publishable) : null;
  checks.push(
    !publishable
      ? fail("Publishable key", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set")
      : publishableKind === "secret"
        ? fail("Publishable key", "this is a secret (service role) key — it would be sent to every browser")
        : pass("Publishable key", publishableKind === "publishable" ? "publishable key" : "set"),
  );

  const service = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!service) checks.push(warn("Service role key", "not set: daily reminders and announcements are switched off"));
  else if (service === publishable || supabaseKeyKind(service) === "publishable")
    checks.push(fail("Service role key", "SUPABASE_SERVICE_ROLE_KEY holds the publishable key"));
  else checks.push(pass("Service role key", "set (server only)"));

  const cron = env.CRON_SECRET ?? "";
  if (service || cron)
    checks.push(
      cron.length >= 32
        ? pass("Cron secret", "set")
        : fail("Cron secret", "CRON_SECRET must be at least 32 random characters (openssl rand -hex 32)"),
    );

  const vapidPublic = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const vapidPrivate = env.VAPID_PRIVATE_KEY ?? "";
  if (!vapidPublic && !vapidPrivate) {
    checks.push(warn("Push keys", "VAPID keys are not set: reminders cannot reach devices"));
  } else {
    const pub = base64UrlBytes(vapidPublic);
    const priv = base64UrlBytes(vapidPrivate);
    if (!pub || pub.length !== 65 || pub[0] !== 4)
      checks.push(fail("Push keys", "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not a VAPID public key"));
    else if (!priv || priv.length !== 32)
      checks.push(fail("Push keys", "VAPID_PRIVATE_KEY is missing or not a VAPID private key"));
    else if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(env.VAPID_SUBJECT ?? ""))
      checks.push(fail("Push keys", "VAPID_SUBJECT must be mailto:<address> or an https URL"));
    else if ((env.VAPID_SUBJECT ?? "").endsWith("@example.com"))
      checks.push(warn("Push keys", "VAPID_SUBJECT is still the example address"));
    else checks.push(pass("Push keys", "valid"));
  }

  if (env.NOTIFICATION_PROVIDER === "log")
    checks.push(fail("Notification provider", "NOTIFICATION_PROVIDER=log only prints messages; leave it empty"));

  const secrets = [service, cron, vapidPrivate].filter(Boolean);
  const exposed = Object.entries(env).filter(
    ([name, value]) =>
      name.startsWith("NEXT_PUBLIC_") && value && (secrets.includes(value) || supabaseKeyKind(value) === "secret"),
  );
  checks.push(
    exposed.length
      ? fail("Browser variables", `${exposed.map(([n]) => n).join(", ")} hold a secret`)
      : pass("Browser variables", "no secrets in NEXT_PUBLIC_ variables"),
  );
  return checks;
}

export function summarize(checks: Check[]): { failed: number; warned: number } {
  return {
    failed: checks.filter((c) => c.status === "fail").length,
    warned: checks.filter((c) => c.status === "warn").length,
  };
}
