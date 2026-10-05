/**
 * Production readiness check. Run it before launch and after each deployment.
 *
 *   pnpm preflight --env-file .env.production.local            # variables and database
 *   pnpm preflight --env-file .env.production.local --site     # … and the live site at NEXT_PUBLIC_SITE_URL
 *
 * `vercel env pull --environment=production .env.production.local` writes the production variables to that file.
 * Exits with 1 when any check fails. Prints no secret values.
 */
import { readFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import { checkEnvironment, summarize, type Check, type Env } from "@/lib/deploy/preflight";

const { values } = parseArgs({
  options: { "env-file": { type: "string" }, site: { type: "boolean", default: false } },
});
const env: Env = values["env-file"]
  ? { ...process.env, ...parseEnv(readFileSync(values["env-file"], "utf8")) }
  : { ...process.env };

const checks: Check[] = [];
const add = (name: string, ok: boolean | "warn", detail: string) =>
  checks.push({ name, status: ok === "warn" ? "warn" : ok ? "pass" : "fail", detail });

/** Row count of a table as the given key sees it (row level security applies to the publishable key). */
async function count(table: string, key: string, filter = "", select = "*"): Promise<number | null> {
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  }).catch(() => null);
  const total = response?.ok ? response.headers.get("content-range")?.split("/")[1] : undefined;
  return total && total !== "*" ? Number(total) : null;
}

async function checkDatabase() {
  const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !anon) return;
  const books = await count("bible_books", anon);
  if (books === null) return add("Database", false, "cannot read bible_books — are the migrations applied?");
  add("Reference data", books >= 73, `${books} Bible books (seed.sql loaded: 73 or more)`);

  const today = new Date().toISOString().slice(0, 10);
  const content: [string, string, string, number | null][] = [
    ["Bible", "bible_translations", "published translations", await count("bible_translations", anon)],
    [
      "Calendar",
      "liturgical_days",
      `liturgical day for ${today}`,
      await count("liturgical_days", anon, `&date=eq.${today}`),
    ],
    ["Prayers", "prayers", "published prayers", await count("prayers", anon)],
    ["Rosary", "rosary_mysteries", "published mysteries", await count("rosary_mysteries", anon)],
    ["Saints", "saints", "published saints", await count("saints", anon)],
  ];
  for (const [name, table, what, n] of content)
    add(name, n ? true : "warn", n === null ? `cannot read ${table}` : `${n} ${what}${n ? "" : " — run the import"}`);

  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (service) {
    const admins = await count("user_roles", service, "&roles.key=eq.super_admin", "user_id,roles!inner(key)");
    add(
      "Super admin",
      admins ? true : "warn",
      admins === null ? "cannot read user_roles with the service key" : `${admins} — pnpm admin:grant to add one`,
    );
  }
}

async function checkSite() {
  const site = env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!site) return;
  const get = (path: string, init?: RequestInit) =>
    fetch(`${site}${path}`, { redirect: "manual", ...init }).catch(() => null);

  const health = await get("/api/health");
  const body = (await health?.json().catch(() => null)) as { database?: string; version?: string } | null;
  add(
    "Health",
    health?.status === 200,
    health ? `${health.status}, database ${body?.database ?? "?"}, version ${body?.version ?? "?"}` : "unreachable",
  );

  const home = await get("/ta");
  const headers = home?.headers;
  add("Home page", home?.status === 200, home ? String(home.status) : "unreachable");
  add(
    "Security headers",
    Boolean(headers?.get("content-security-policy") && headers?.get("strict-transport-security")),
    "CSP and HSTS",
  );

  const robots = await (await get("/robots.txt"))?.text();
  add(
    "robots.txt",
    Boolean(robots?.includes("Sitemap:")),
    robots?.includes("Disallow: /\n") ? "blocks everything (not production?)" : "lists the sitemap",
  );
  const sitemap = await get("/sitemap.xml");
  add("Sitemap", sitemap?.status === 200, sitemap ? String(sitemap.status) : "unreachable");

  const cron = await get("/api/cron/notifications");
  add(
    "Cron endpoint",
    cron?.status === 401,
    cron?.status === 401 ? "refuses unsigned calls" : `answered ${cron?.status ?? "nothing"} without the secret`,
  );
}

async function main() {
  checks.push(...checkEnvironment(env));
  await checkDatabase();
  if (values.site) await checkSite();

  const ICON = { pass: "✓", warn: "!", fail: "✗" } as const;
  for (const c of checks) console.log(`${ICON[c.status]} ${c.name.padEnd(20)} ${c.detail}`);
  const { failed, warned } = summarize(checks);
  console.log(`\n${failed} failed, ${warned} warnings, ${checks.length - failed - warned} passed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
