import "server-only";
import { z } from "zod";
import type { adminDb } from "./data";

export const announcementSchema = z.object({
  id: z.string(),
  title_en: z.string(),
  title_ta: z.string(),
  body_en: z.string().nullable(),
  body_ta: z.string().nullable(),
  url: z.string().nullable(),
  scheduled_at: z.string(),
  status: z.enum(["scheduled", "sending", "sent", "cancelled", "failed"]),
  recipients: z.number(),
});
export type Announcement = z.infer<typeof announcementSchema>;

export async function listAnnouncements(db: Awaited<ReturnType<typeof adminDb>>): Promise<Announcement[]> {
  const { data, error } = await db
    .from("notifications")
    .select("id, title_en, title_ta, body_en, body_ta, url, scheduled_at, status, recipients")
    .eq("kind", "announcement")
    .order("scheduled_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return z.array(announcementSchema).parse(data);
}

/** "2026-12-24T18:00" in India time, for a datetime-local input. */
export function indiaLocal(instant: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** The default send time of a new announcement: an hour from now, in India time. */
export function defaultSendTime(): string {
  return indiaLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString());
}
