import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient, type DbClient } from "@/lib/db/public";
import type { CalendarCode, Season } from "@/lib/liturgy";
import type { LiturgicalColor } from "@/lib/design/liturgical-colors";
import { daysInMonth } from "@/lib/liturgy/plain-date";
import { monthKey } from "@/lib/liturgy/months";
import { buildSafe } from "./build-safe";

export type CalendarMonthDay = {
  date: string;
  color: LiturgicalColor;
  kind: string;
  titleEn: string;
  titleTa: string;
  season: Season;
  week: number | null;
  /** Memorials and optional memorials that may be kept (not the day's own celebration). */
  memorials: { code: string; nameEn: string; nameTa: string; kind: string }[];
};

const rowSchema = z.object({
  date: z.string(),
  color: z.string(),
  kind: z.string(),
  title_en: z.string(),
  title_ta: z.string(),
  season: z.string(),
  week_number: z.number().nullable(),
  liturgical_day_celebrations: z.array(
    z.object({
      is_primary: z.boolean(),
      sort_order: z.number(),
      celebrations: z.object({ code: z.string(), name_en: z.string(), name_ta: z.string(), rank: z.string() }),
    }),
  ),
});

export async function getMonth(
  db: DbClient,
  calendar: CalendarCode,
  year: number,
  month: number,
): Promise<CalendarMonthDay[]> {
  const start = `${monthKey(year, month)}-01`;
  const end = `${monthKey(year, month)}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
  const { data, error } = await db
    .from("liturgical_days")
    .select(
      "date, color, kind, title_en, title_ta, season, week_number, liturgical_calendars!inner(code), liturgical_day_celebrations(is_primary, sort_order, celebrations(code, name_en, name_ta, rank))",
    )
    .eq("liturgical_calendars.code", calendar)
    .gte("date", start)
    .lte("date", end)
    .order("date");
  if (error) throw new Error(`Failed to load calendar month: ${error.message}`);

  return z
    .array(rowSchema)
    .parse(data)
    .map((d) => ({
      date: d.date,
      color: d.color as LiturgicalColor,
      kind: d.kind,
      titleEn: d.title_en,
      titleTa: d.title_ta,
      season: d.season as Season,
      week: d.week_number,
      memorials: d.liturgical_day_celebrations
        .filter((c) => !c.is_primary)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          code: c.celebrations.code,
          nameEn: c.celebrations.name_en,
          nameTa: c.celebrations.name_ta,
          kind: c.celebrations.rank,
        })),
    }));
}

export const publicCalendarMonth = cache(async (calendar: CalendarCode, year: number, month: number) => {
  const db = createPublicClient();
  if (!db) return null;
  return buildSafe(() => getMonth(db, calendar, year, month), null);
});
