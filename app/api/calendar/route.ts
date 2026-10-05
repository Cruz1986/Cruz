import type { NextRequest } from "next/server";
import { DEFAULT_CALENDAR } from "@/lib/content/today";
import { publicCalendarMonth } from "@/lib/content/calendar";
import { CALENDARS, type CalendarCode } from "@/lib/liturgy";
import { parseMonth } from "@/lib/liturgy/months";
import { apiError, json } from "@/lib/api";

/** GET /api/calendar?month=YYYY-MM&calendar=in — every day of a month with colour, rank and celebrations. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parseMonth(params.get("month") ?? "");
  if (!parsed) return apiError(400, "invalid_month", "month must be YYYY-MM.");
  const calendar = (params.get("calendar") ?? DEFAULT_CALENDAR) as CalendarCode;
  if (!(calendar in CALENDARS)) return apiError(400, "invalid_calendar", "Unknown calendar.");

  const days = await publicCalendarMonth(calendar, parsed.year, parsed.month);
  if (!days) return apiError(503, "calendar_unavailable", "The calendar is not available.");
  return json(
    {
      calendar,
      month: params.get("month"),
      days: days.map((d) => ({
        date: d.date,
        title: { en: d.titleEn, ta: d.titleTa },
        kind: d.kind,
        color: d.color,
        season: d.season,
        week: d.week,
        memorials: d.memorials.map((m) => ({ code: m.code, name: { en: m.nameEn, ta: m.nameTa }, kind: m.kind })),
      })),
    },
    { maxAge: 3600 },
  );
}
