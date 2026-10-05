import type { NextRequest } from "next/server";
import { DEFAULT_CALENDAR, publicToday } from "@/lib/content/today";
import { publicReflections } from "@/lib/content/reflections";
import { CALENDARS, type CalendarCode } from "@/lib/liturgy";
import { parseIsoDate, todayIn, toIso } from "@/lib/liturgy/plain-date";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { apiError, json } from "@/lib/api";

/** GET /api/today?date=YYYY-MM-DD&calendar=in&lang=ta — liturgical day, celebrations and readings. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? toIso(todayIn(DEFAULT_TIME_ZONE));
  if (!parseIsoDate(date)) return apiError(400, "invalid_date", "date must be YYYY-MM-DD.");
  const calendar = (params.get("calendar") ?? DEFAULT_CALENDAR) as CalendarCode;
  if (!(calendar in CALENDARS)) return apiError(400, "invalid_calendar", "Unknown calendar.");
  const lang = params.get("lang") === "en" ? "en" : "ta";

  const day = await publicToday(calendar, date, lang);
  if (!day) return apiError(404, "day_not_found", "No liturgical data for this date.");
  const reflections = await publicReflections(date);
  return json(
    {
      date: day.date,
      calendar,
      title: { en: day.titleEn, ta: day.titleTa },
      kind: day.kind,
      color: day.color,
      season: day.season,
      week: day.week,
      cycles: { sunday: day.sundayCycle, weekday: day.weekdayCycle },
      celebrations: day.celebrations.map((c) => ({
        code: c.code,
        name: { en: c.nameEn, ta: c.nameTa },
        kind: c.kind,
        primary: c.isPrimary,
      })),
      reflections: reflections.map((r) => ({ language: r.language, title: r.title, body: r.body, author: r.author })),
      masses: day.masses.map((m) => ({
        key: m.key,
        readings: m.slots.map((s) => ({
          type: s.type,
          sequence: s.sequence,
          options: s.options.map((o) => ({ reference: o.reference, shorter: o.isShort, ranges: o.ranges })),
        })),
      })),
    },
    { maxAge: 3600 },
  );
}
