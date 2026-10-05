import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/db/public";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — for uptime monitors. 200 when the app can read published content, 503 when the
 * database is unreachable. Reports no configuration details.
 */
export async function GET() {
  const db = createPublicClient();
  let database: "ok" | "unavailable" | "not_configured" = "not_configured";
  if (db) {
    const { error } = await db.from("bible_translations").select("code").limit(1);
    database = error ? "unavailable" : "ok";
  }
  const ok = database === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", database, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
