/**
 * Liturgical day facts for the app: celebrations, season, week and lectionary cycles.
 * Pure functions; the database stores generated years so admins can override single days.
 */
import { generateYear, seasonLimits, type CalendarEntry, type CalendarOptions } from "./generate";
import { addDays, compare, type PlainDate } from "./plain-date";
import { dayTitle } from "./titles";
import type { LiturgicalColor } from "@/lib/design/liturgical-colors";

export type CalendarCode = "gr" | "in";

export const CALENDARS: Record<CalendarCode, CalendarOptions> = {
  gr: { epiphanyOnSunday: false, ascensionOnSunday: false, corpusChristiOnSunday: false, india: false },
  in: { epiphanyOnSunday: true, ascensionOnSunday: true, corpusChristiOnSunday: true, india: true },
};

export type Season = "advent" | "christmas" | "ordinary" | "lent" | "triduum" | "easter";

export type Celebration = CalendarEntry & {
  titleEn: string;
  titleTa: string;
  kind: "solemnity" | "feast" | "memorial" | "optional_memorial" | "commemoration" | "weekday" | "sunday";
};

export type LiturgicalDay = {
  date: PlainDate;
  /** The day itself, then memorials that may be kept. */
  celebrations: Celebration[];
  suppressed: Celebration[];
  color: LiturgicalColor;
  season: Season;
  /** Week of the season (Ordinary Time 1–34, Lent 0–6, …); null outside numbered weeks. */
  week: number | null;
  /** Ferial code of the day before any feast was placed on it (for the weekday lectionary). */
  ferialCode: string | null;
  sundayCycle: "A" | "B" | "C";
  weekdayCycle: "I" | "II";
};

function kindOf(entry: CalendarEntry): Celebration["kind"] {
  const t = entry.type ?? "";
  if (t.startsWith("Solemnity") || t === "All Souls") return "solemnity";
  if (t.startsWith("Feast")) return "feast";
  if (t === "OpMem-Commemoration") return "commemoration";
  if (t.startsWith("OpMem")) return "optional_memorial";
  if (t.startsWith("Mem")) return "memorial";
  return /-0Sun$/.test(entry.code) ? "sunday" : "weekday";
}

function seasonOf(date: PlainDate, year: number, options: CalendarOptions): Season {
  const l = seasonLimits(year, options.epiphanyOnSunday);
  if (compare(date, l.baptism) <= 0) return "christmas";
  if (compare(date, l.lent) < 0) return "ordinary";
  if (compare(date, addDays(l.easter, -3)) < 0) return "lent";
  if (compare(date, l.easter) < 0) return "triduum";
  if (compare(date, addDays(l.easter, 49)) <= 0) return "easter";
  if (compare(date, l.advent) < 0) return "ordinary";
  if (compare(date, l.christmas) < 0) return "advent";
  return "christmas";
}

/** Sunday cycle A/B/C and weekday cycle I/II of the liturgical year containing `date`. */
export function cycles(date: PlainDate, options: CalendarOptions) {
  const startsNext = compare(date, seasonLimits(date.year, options.epiphanyOnSunday).advent) >= 0;
  const liturgicalYear = startsNext ? date.year + 1 : date.year; // named after the year it ends in
  return {
    sundayCycle: (["A", "B", "C"] as const)[
      (liturgicalYear - 1) % 3 === 0 ? 0 : (liturgicalYear - 1) % 3 === 1 ? 1 : 2
    ],
    weekdayCycle: liturgicalYear % 2 === 0 ? ("II" as const) : ("I" as const),
  };
}

const yearCache = new Map<string, ReturnType<typeof generateYear>>();
const ferialCache = new Map<string, Map<string, string>>();

function generated(year: number, calendar: CalendarCode) {
  const key = `${calendar}:${year}`;
  let days = yearCache.get(key);
  if (!days) {
    days = generateYear(year, CALENDARS[calendar]);
    yearCache.set(key, days);
    // Ferial codes: what each day was before fixed celebrations (found in entries or suppressed).
    const ferial = new Map<string, string>();
    for (const d of days) {
      const code = [...d.entries, ...d.suppressed].find((e) => /^(AW|CW|LW|EW|OW)\d{2}-/.test(e.code))?.code;
      if (code) ferial.set(`${d.date.month}-${d.date.day}`, code);
    }
    ferialCache.set(key, ferial);
  }
  return { days, ferial: ferialCache.get(key)! };
}

function toCelebration(entry: CalendarEntry, options: CalendarOptions): Celebration {
  const title = dayTitle(entry.code, options.epiphanyOnSunday);
  return { ...entry, titleEn: title.en, titleTa: title.ta, kind: kindOf(entry) };
}

export function liturgicalYear(year: number, calendar: CalendarCode): LiturgicalDay[] {
  const options = CALENDARS[calendar];
  const { days, ferial } = generated(year, calendar);
  return days.map((d) => {
    const ferialCode = ferial.get(`${d.date.month}-${d.date.day}`) ?? null;
    const week = ferialCode && /^(AW|LW|EW|OW)\d{2}-\d/.test(ferialCode) ? Number(ferialCode.slice(2, 4)) : null;
    return {
      date: d.date,
      celebrations: d.entries.map((e) => toCelebration(e, options)),
      suppressed: d.suppressed.map((e) => toCelebration(e, options)),
      color: d.entries[0].color,
      season: seasonOf(d.date, year, options),
      week,
      ferialCode,
      ...cycles(d.date, options),
    };
  });
}

export function liturgicalDay(date: PlainDate, calendar: CalendarCode): LiturgicalDay {
  return liturgicalYear(date.year, calendar).find((d) => compare(d.date, date) === 0)!;
}
