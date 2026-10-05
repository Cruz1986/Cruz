import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient, type DbClient } from "@/lib/db/public";
import type { CalendarCode, Season } from "@/lib/liturgy";
import type { LiturgicalColor } from "@/lib/design/liturgical-colors";
import type { ReadingType, VerseRange } from "@/lib/liturgy/lectionary";
import {
  assembleMasses,
  vkeyRanges,
  type LectionaryReading,
  type Mass,
  type MassSet,
  type MemorialReadings,
} from "@/lib/liturgy/readings";
import { listTranslations, type Translation } from "./bible";
import { defaultTranslation } from "./public-bible";
import { buildSafe } from "./build-safe";

/** The app's default calendar (General Roman + India). */
export const DEFAULT_CALENDAR: CalendarCode = "in";

const rangeSchema = z.object({
  seq: z.number(),
  start_chapter: z.number(),
  start_verse: z.number(),
  start_part: z.string(),
  end_chapter: z.number(),
  end_verse: z.number(),
  end_part: z.string(),
  bible_books: z.object({ code: z.string(), canon_order: z.number() }),
});

const readingSchema = z.object({
  reading_type: z.string(),
  sequence: z.number(),
  alt_group: z.number(),
  is_short: z.boolean(),
  is_proper: z.boolean(),
  source_type: z.string(),
  reference_display: z.string(),
  lectionary_reading_ranges: z.array(rangeSchema),
});

const daySchema = z.object({
  date: z.string(),
  season: z.string(),
  week_number: z.number().nullable(),
  sunday_cycle: z.enum(["A", "B", "C"]),
  weekday_cycle: z.enum(["I", "II"]),
  color: z.string(),
  day_code: z.string(),
  title_en: z.string(),
  title_ta: z.string(),
  kind: z.string(),
  notes_en: z.string().nullable(),
  notes_ta: z.string().nullable(),
  liturgical_day_celebrations: z.array(
    z.object({
      is_primary: z.boolean(),
      sort_order: z.number(),
      celebrations: z.object({
        code: z.string(),
        name_en: z.string(),
        name_ta: z.string(),
        rank: z.string(),
        color: z.string(),
        saints: z.object({ slug: z.string() }).nullable(),
      }),
    }),
  ),
  liturgical_day_masses: z.array(
    z.object({
      mass_key: z.enum(["vigil", "night", "dawn", "day", "chrism"]),
      role: z.enum(["base", "memorial"]),
      sort_order: z.number(),
      celebrations: z.object({ code: z.string() }).nullable(),
      lectionary_sets: z.object({ code: z.string(), lectionary_readings: z.array(readingSchema) }),
    }),
  ),
});

export type DayCelebration = {
  code: string;
  nameEn: string;
  nameTa: string;
  kind: string;
  color: LiturgicalColor;
  isPrimary: boolean;
  /** Profile of the saint this celebration honours, when published. */
  saintSlug: string | null;
};

export type Today = {
  date: string;
  titleEn: string;
  titleTa: string;
  kind: string;
  /** Editors' notes for the day (e.g. a local observance). */
  notesEn: string | null;
  notesTa: string | null;
  color: LiturgicalColor;
  season: Season;
  week: number | null;
  sundayCycle: "A" | "B" | "C";
  weekdayCycle: "I" | "II";
  isSunday: boolean;
  celebrations: DayCelebration[];
  masses: Mass[];
  memorials: (MemorialReadings & { nameEn: string; nameTa: string })[];
  canonOrder: Map<string, number>;
};

const DAY_SELECT = `
  date, season, week_number, sunday_cycle, weekday_cycle, color, day_code, title_en, title_ta, kind, notes_en, notes_ta,
  liturgical_calendars!inner(code),
  liturgical_day_celebrations(is_primary, sort_order, celebrations(code, name_en, name_ta, rank, color, saints(slug))),
  liturgical_day_masses(mass_key, role, sort_order, celebrations(code),
    lectionary_sets(code, lectionary_readings(reading_type, sequence, alt_group, is_short, is_proper, source_type, reference_display,
      lectionary_reading_ranges(seq, start_chapter, start_verse, start_part, end_chapter, end_verse, end_part, bible_books(code, canon_order)))))`;

export async function getLiturgicalDay(db: DbClient, calendar: CalendarCode, isoDate: string): Promise<Today | null> {
  const { data, error } = await db
    .from("liturgical_days")
    .select(DAY_SELECT)
    .eq("liturgical_calendars.code", calendar)
    .eq("date", isoDate)
    .maybeSingle();
  if (error) throw new Error(`Failed to load liturgical day: ${error.message}`);
  if (!data) return null;
  const day = daySchema.parse(data);

  const canonOrder = new Map<string, number>();
  const sets: MassSet[] = day.liturgical_day_masses
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      massKey: m.mass_key,
      role: m.role,
      celebrationCode: m.celebrations?.code ?? null,
      setCode: m.lectionary_sets.code,
      readings: m.lectionary_sets.lectionary_readings.map((r): LectionaryReading => ({
        type: r.reading_type as ReadingType,
        sequence: r.sequence,
        altGroup: r.alt_group,
        isShort: r.is_short,
        isProper: r.is_proper,
        sourceType: r.source_type,
        reference: r.reference_display,
        ranges: r.lectionary_reading_ranges
          .sort((a, b) => a.seq - b.seq)
          .map((g): VerseRange => {
            canonOrder.set(g.bible_books.code, g.bible_books.canon_order);
            return {
              book: g.bible_books.code,
              startChapter: g.start_chapter,
              startVerse: g.start_verse,
              startPart: g.start_part,
              endChapter: g.end_chapter,
              endVerse: g.end_verse,
              endPart: g.end_part,
            };
          }),
      })),
    }));

  const isSunday = new Date(`${day.date}T00:00:00Z`).getUTCDay() === 0;
  const { masses, memorials } = assembleMasses(sets, { weekdayFeast: day.kind === "feast" && !isSunday });
  const celebrations = day.liturgical_day_celebrations
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      code: c.celebrations.code,
      nameEn: c.celebrations.name_en,
      nameTa: c.celebrations.name_ta,
      kind: c.celebrations.rank,
      color: c.celebrations.color as LiturgicalColor,
      isPrimary: c.is_primary,
      saintSlug: c.celebrations.saints?.slug ?? null,
    }));
  const names = new Map(celebrations.map((c) => [c.code, c]));

  return {
    date: day.date,
    titleEn: day.title_en,
    titleTa: day.title_ta,
    kind: day.kind,
    notesEn: day.notes_en,
    notesTa: day.notes_ta,
    color: day.color as LiturgicalColor,
    season: day.season as Season,
    week: day.week_number,
    sundayCycle: day.sunday_cycle,
    weekdayCycle: day.weekday_cycle,
    isSunday,
    celebrations,
    masses,
    memorials: memorials
      .filter((m) => m.slots.length || m.commons.length)
      .map((m) => ({
        ...m,
        nameEn: names.get(m.celebrationCode)?.nameEn ?? m.celebrationCode,
        nameTa: names.get(m.celebrationCode)?.nameTa ?? m.celebrationCode,
      })),
    canonOrder,
  };
}

export type PassageVerse = { key: number; label: string; text: string; isPoetry: boolean };

/** Bible text for every reading of the day, keyed by "start-end" verse-key range. */
export async function getPassages(
  db: DbClient,
  translation: Translation,
  ranges: [number, number][],
): Promise<Map<string, PassageVerse[]>> {
  const unique = [...new Map(ranges.map((r) => [`${r[0]}-${r[1]}`, r])).values()];
  const result = new Map<string, PassageVerse[]>();
  if (unique.length === 0) return result;

  const filter = unique.map(([a, b]) => `and(canonical_vkey.gte.${a},canonical_vkey.lte.${b})`).join(",");
  const { data, error } = await db
    .from("bible_verses")
    .select("canonical_vkey, verse, verse_label, verse_part, text, is_poetry")
    .eq("translation_id", translation.id)
    .or(filter)
    .order("canonical_vkey")
    .order("ordinal")
    .limit(1000);
  if (error) throw new Error(`Failed to load passages: ${error.message}`);

  const verses = z
    .array(
      z.object({
        canonical_vkey: z.number(),
        verse: z.number(),
        verse_label: z.string().nullable(),
        verse_part: z.string(),
        text: z.string(),
        is_poetry: z.boolean(),
      }),
    )
    .parse(data)
    .map((v) => ({
      key: v.canonical_vkey,
      label: v.verse_label ?? `${v.verse}${v.verse_part}`,
      text: v.text,
      isPoetry: v.is_poetry,
    }));
  for (const [a, b] of unique)
    result.set(
      `${a}-${b}`,
      verses.filter((v) => v.key >= a && v.key <= b),
    );
  return result;
}

export type TodayWithText = Today & { translation: Translation | null; passages: Map<string, PassageVerse[]> };

/** Published day + passages in the reader's language when available (memoised per request). */
export const publicToday = cache(
  async (calendar: CalendarCode, isoDate: string, locale: string): Promise<TodayWithText | null> => {
    const db = createPublicClient();
    if (!db) return null;
    return buildSafe(() => loadToday(db, calendar, isoDate, locale), null);
  },
);

async function loadToday(
  db: DbClient,
  calendar: CalendarCode,
  isoDate: string,
  locale: string,
): Promise<TodayWithText | null> {
  const day = await getLiturgicalDay(db, calendar, isoDate);
  if (!day) return null;
  const translation = defaultTranslation(await listTranslations(db), locale);
  const ranges = day.masses
    .flatMap((m) => m.slots)
    .concat(day.memorials.flatMap((m) => m.slots))
    .flatMap((s) => s.options)
    .flatMap((o) => vkeyRanges(o.ranges, day.canonOrder));
  const passages = translation ? await getPassages(db, translation, ranges) : new Map();
  return { ...day, translation, passages };
}
