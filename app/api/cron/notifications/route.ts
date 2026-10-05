import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/db/service";
import { configuredProvider } from "@/lib/notifications/provider";
import { runNotifications } from "@/lib/notifications/send";
import { apiError, json } from "@/lib/api";

export const dynamic = "force-dynamic";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET /api/cron/notifications — sends the reminders and announcements that are due. Called every 15 minutes
 * by the scheduler with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically).
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return apiError(503, "not_configured", "CRON_SECRET is not set.");
  if (!authorized(request.headers.get("authorization")))
    return apiError(401, "unauthorized", "Missing or wrong secret.");
  const db = createServiceClient();
  const provider = configuredProvider();
  if (!db || !provider) return apiError(503, "not_configured", "Service key or notification provider is not set.");
  const summary = await runNotifications(db, provider);
  return json({ provider: provider.name, ...summary });
}
