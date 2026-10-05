import "server-only";
import { z } from "zod";
import type { createServiceClient } from "@/lib/db/service";
import { getLiturgicalDay, DEFAULT_CALENDAR } from "@/lib/content/today";
import { listSaints } from "@/lib/content/saints";
import { getRosaryData } from "@/lib/content/rosary";
import { saintsOfDay } from "@/lib/saints/helpers";
import { todaysMysteries } from "@/lib/rosary/today";
import { formatRanges } from "@/lib/liturgy/readings";
import { parseIsoDate } from "@/lib/liturgy/plain-date";
import en from "@/messages/en.json";
import ta from "@/messages/ta.json";
import { composeReminder, type DayInfo, type PushPayload } from "./compose";
import type { NotificationProvider, PushSubscriptionRow } from "./provider";

type Db = NonNullable<ReturnType<typeof createServiceClient>>;
export type RunSummary = { reminders: number; announcements: number; sent: number; gone: number; failed: number };

const dueSchema = z.object({
  user_id: z.string(),
  local_date: z.string(),
  local_time: z.string(),
  language: z.enum(["ta", "en"]),
  daily_reading: z.boolean(),
  saint_of_day: z.boolean(),
  prayer: z.boolean(),
  rosary: z.boolean(),
});
const subscriptionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  endpoint: z.string(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
type Subscription = z.infer<typeof subscriptionSchema>;

/** What the day holds, in both languages (gospel, saints, Rosary mysteries). */
async function loadDayInfo(db: Db, date: string): Promise<DayInfo> {
  const [day, saints, rosary, books] = await Promise.all([
    getLiturgicalDay(db, DEFAULT_CALENDAR, date),
    listSaints(db),
    getRosaryData(db),
    db.from("bible_books").select("code, abbr_en"),
  ]);
  const abbr = new Map(
    z
      .array(z.object({ code: z.string(), abbr_en: z.string() }))
      .catch([])
      .parse(books.data)
      .map((b) => [b.code, b.abbr_en]),
  );
  const mass = day?.masses.find((m) => m.key === "day") ?? day?.masses.at(-1);
  const gospel = mass?.slots.find((s) => s.type === "gospel")?.options[0];
  const plain = parseIsoDate(date)!;
  const published = saints.filter((s) => s.status === "published");
  const idBySlug = new Map(published.map((s) => [s.slug, s.id]));
  const celebrated = (day?.celebrations ?? []).flatMap((c) => (c.saintSlug && idBySlug.get(c.saintSlug)) || []);
  const ofDay = saintsOfDay(plain, celebrated, published);
  const setKey = rosary ? todaysMysteries(rosary.sets, date) : null;
  const set = rosary?.sets.find((s) => s.key === setKey);
  return {
    title: day ? { en: day.titleEn, ta: day.titleTa } : null,
    season: day?.season ?? null,
    gospel: gospel
      ? {
          en: gospel.ranges.length ? formatRanges(gospel.ranges, (c) => abbr.get(c) ?? c) : gospel.reference,
          ta: gospel.reference,
        }
      : null,
    saints: ofDay.map((s) => ({ en: s.nameEn, ta: s.nameTa })),
    rosary: set ? { en: set.nameEn, ta: set.nameTa } : null,
  };
}

async function subscriptionsOf(db: Db, userIds: string[]): Promise<Subscription[]> {
  if (!userIds.length) return [];
  const { data, error } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, keys")
    .in("user_id", userIds);
  if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);
  return z.array(subscriptionSchema).catch([]).parse(data);
}

/** Sends to each device; removes subscriptions the push service says are gone. */
async function deliver(
  db: Db,
  provider: NotificationProvider,
  subs: Subscription[],
  payload: PushPayload,
  summary: RunSummary,
) {
  let sent = 0;
  for (const sub of subs) {
    const result = await provider.send(
      { endpoint: sub.endpoint, keys: sub.keys } satisfies PushSubscriptionRow,
      payload,
    );
    summary[result] += 1;
    if (result === "sent") {
      sent += 1;
      await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
    } else if (result === "gone") {
      await db.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
  return sent;
}

/**
 * One run of the scheduled job: daily reminders due in this window (each reader at most once per local
 * date, however often the job runs) and announcements whose time has come.
 */
export async function runNotifications(
  db: Db,
  provider: NotificationProvider,
  { now = new Date(), windowMinutes = 15 }: { now?: Date; windowMinutes?: number } = {},
): Promise<RunSummary> {
  const summary: RunSummary = { reminders: 0, announcements: 0, sent: 0, gone: 0, failed: 0 };

  // Reminders
  const { data, error } = await db.rpc("due_reminders", { p_now: now.toISOString(), p_window_minutes: windowMinutes });
  if (error) throw new Error(`Failed to find due reminders: ${error.message}`);
  const due = z.array(dueSchema).parse(data);
  const days = new Map<string, Promise<DayInfo>>();
  const subs = await subscriptionsOf(
    db,
    due.map((d) => d.user_id),
  );
  for (const reader of due) {
    // Claim the reader's date first so a parallel or repeated run never sends twice.
    const claim = await db
      .from("notification_deliveries")
      .upsert(
        { user_id: reader.user_id, local_date: reader.local_date },
        { onConflict: "user_id,local_date", ignoreDuplicates: true },
      )
      .select("user_id");
    if (claim.error || !claim.data?.length) continue;

    if (!days.has(reader.local_date)) days.set(reader.local_date, loadDayInfo(db, reader.local_date));
    const messages = reader.language === "ta" ? ta : en;
    const payload = composeReminder({
      parts: {
        dailyReading: reader.daily_reading,
        saintOfDay: reader.saint_of_day,
        prayer: reader.prayer,
        rosary: reader.rosary,
      },
      day: await days.get(reader.local_date)!,
      locale: reader.language,
      localDate: reader.local_date,
      localHour: Number(reader.local_time.slice(0, 2)),
      labels: messages.notifications.labels,
    });
    const devices = await deliver(
      db,
      provider,
      subs.filter((s) => s.user_id === reader.user_id),
      payload,
      summary,
    );
    await db
      .from("notification_deliveries")
      .update({ devices })
      .eq("user_id", reader.user_id)
      .eq("local_date", reader.local_date);
    summary.reminders += 1;
  }

  // Announcements: claim the due ones, then send to readers who turned reminders on.
  const claimed = await db
    .from("notifications")
    .update({ status: "sending" })
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .select("id, title_en, title_ta, body_en, body_ta, url");
  if (claimed.error) throw new Error(`Failed to claim announcements: ${claimed.error.message}`);
  const announcements = z
    .array(
      z.object({
        id: z.string(),
        title_en: z.string(),
        title_ta: z.string(),
        body_en: z.string().nullable(),
        body_ta: z.string().nullable(),
        url: z.string().nullable(),
      }),
    )
    .parse(claimed.data);
  if (announcements.length) {
    const { data: prefs } = await db.from("notification_preferences").select("user_id").eq("enabled", true);
    const readers = z
      .array(z.object({ user_id: z.string() }))
      .catch([])
      .parse(prefs)
      .map((p) => p.user_id);
    const { data: profiles } = readers.length
      ? await db.from("profiles").select("id, preferred_language").in("id", readers)
      : { data: [] };
    const language = new Map(
      z
        .array(z.object({ id: z.string(), preferred_language: z.enum(["ta", "en"]) }))
        .catch([])
        .parse(profiles)
        .map((p) => [p.id, p.preferred_language]),
    );
    const readerSubs = await subscriptionsOf(db, readers);
    for (const a of announcements) {
      let recipients = 0;
      for (const userId of readers) {
        const lang = language.get(userId) ?? "ta";
        const payload: PushPayload = {
          title: lang === "ta" ? a.title_ta : a.title_en,
          body: (lang === "ta" ? (a.body_ta ?? a.body_en) : (a.body_en ?? a.body_ta)) ?? "",
          url: `/${lang}${a.url ?? ""}`,
          tag: `announcement-${a.id}`,
        };
        if (
          await deliver(
            db,
            provider,
            readerSubs.filter((s) => s.user_id === userId),
            payload,
            summary,
          )
        )
          recipients += 1;
      }
      await db
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipients })
        .eq("id", a.id);
      summary.announcements += 1;
    }
  }
  return summary;
}
