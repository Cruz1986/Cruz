import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient, type DbClient } from "@/lib/db/public";
import { getSupabaseConfig } from "@/lib/env";
import type { CalendarCode } from "@/lib/liturgy";
import { parseIsoDate } from "@/lib/liturgy/plain-date";
import { saintsOfDay, type SaintSummary } from "@/lib/saints/helpers";
import { buildSafe } from "./build-safe";

export type ContentStatus = "draft" | "in_review" | "published" | "archived";
export type SaintListItem = SaintSummary & { id: string; status: ContentStatus };
export type SaintImage = { url: string; altEn: string | null; altTa: string | null; attribution: string | null };
export type Saint = SaintListItem & {
  birthYear: number | null;
  deathYear: number | null;
  biographyEn: string | null;
  biographyTa: string | null;
  sourceId: string;
  updatedAt: string;
  image: SaintImage | null;
  prayers: { slug: string; titleEn: string | null; titleTa: string | null }[];
};

const statusSchema = z.enum(["draft", "in_review", "published", "archived"]);
const summarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name_en: z.string(),
  name_ta: z.string(),
  title_en: z.string().nullable(),
  title_ta: z.string().nullable(),
  feast_month: z.number().nullable(),
  feast_day: z.number().nullable(),
  patronage_en: z.string().nullable(),
  patronage_ta: z.string().nullable(),
  status: statusSchema,
});
const saintSchema = summarySchema.extend({
  birth_year: z.number().nullable(),
  death_year: z.number().nullable(),
  biography_en: z.string().nullable(),
  biography_ta: z.string().nullable(),
  source_id: z.string(),
  updated_at: z.string(),
  media: z
    .object({
      storage_path: z.string(),
      alt_en: z.string().nullable(),
      alt_ta: z.string().nullable(),
      attribution_text: z.string().nullable(),
    })
    .nullable(),
  saint_prayers: z.array(
    z.object({
      sort_order: z.number(),
      prayers: z
        .object({ slug: z.string(), title_en: z.string().nullable(), title_ta: z.string().nullable() })
        .nullable(),
    }),
  ),
});

const SUMMARY_COLUMNS =
  "id, slug, name_en, name_ta, title_en, title_ta, feast_month, feast_day, patronage_en, patronage_ta, status";
const SAINT_COLUMNS = `${SUMMARY_COLUMNS}, birth_year, death_year, biography_en, biography_ta, source_id, updated_at,
  media(storage_path, alt_en, alt_ta, attribution_text),
  saint_prayers(sort_order, prayers(slug, title_en, title_ta))`;

function toSummary(row: z.infer<typeof summarySchema>): SaintListItem {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameTa: row.name_ta,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    feastMonth: row.feast_month,
    feastDay: row.feast_day,
    patronageEn: row.patronage_en,
    patronageTa: row.patronage_ta,
    status: row.status,
  };
}

/** Public URL of a file in the "media" storage bucket. */
export function mediaUrl(path: string): string | null {
  const config = getSupabaseConfig();
  return config
    ? `${config.url}/storage/v1/object/public/media/${path.split("/").map(encodeURIComponent).join("/")}`
    : null;
}

/** Saints visible to the client (published only for the public client; all for staff), in calendar order. */
export async function listSaints(db: DbClient): Promise<SaintListItem[]> {
  const { data, error } = await db
    .from("saints")
    .select(SUMMARY_COLUMNS)
    .order("feast_month", { nullsFirst: false })
    .order("feast_day")
    .order("name_en");
  if (error) throw new Error(`Failed to load saints: ${error.message}`);
  return z.array(summarySchema).parse(data).map(toSummary);
}

export async function getSaintBy(db: DbClient, field: "slug" | "id", value: string): Promise<Saint | null> {
  const { data, error } = await db.from("saints").select(SAINT_COLUMNS).eq(field, value).maybeSingle();
  if (error) throw new Error(`Failed to load saint: ${error.message}`);
  if (!data) return null;
  const row = saintSchema.parse(data);
  const url = row.media ? mediaUrl(row.media.storage_path) : null;
  return {
    ...toSummary(row),
    birthYear: row.birth_year,
    deathYear: row.death_year,
    biographyEn: row.biography_en,
    biographyTa: row.biography_ta,
    sourceId: row.source_id,
    updatedAt: row.updated_at,
    image:
      row.media && url
        ? { url, altEn: row.media.alt_en, altTa: row.media.alt_ta, attribution: row.media.attribution_text }
        : null,
    prayers: row.saint_prayers
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((p) =>
        p.prayers ? [{ slug: p.prayers.slug, titleEn: p.prayers.title_en, titleTa: p.prayers.title_ta }] : [],
      ),
  };
}

/** Saint ids of the celebrations the calendar keeps on a date, in the calendar's order. */
async function celebratedSaints(db: DbClient, calendar: CalendarCode, isoDate: string): Promise<string[]> {
  const { data, error } = await db
    .from("liturgical_days")
    .select("liturgical_calendars!inner(code), liturgical_day_celebrations(sort_order, celebrations(saint_id))")
    .eq("liturgical_calendars.code", calendar)
    .eq("date", isoDate)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the day's celebrations: ${error.message}`);
  if (!data) return [];
  return z
    .object({
      liturgical_day_celebrations: z.array(
        z.object({ sort_order: z.number(), celebrations: z.object({ saint_id: z.string().nullable() }) }),
      ),
    })
    .parse(data)
    .liturgical_day_celebrations.sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((c) => (c.celebrations.saint_id ? [c.celebrations.saint_id] : []));
}

export const publicSaints = {
  list: cache(async () => {
    const db = createPublicClient();
    return db ? buildSafe(() => listSaints(db), []) : [];
  }),
  bySlug: cache(async (slug: string) => {
    const db = createPublicClient();
    return db ? buildSafe(() => getSaintBy(db, "slug", slug), null) : null;
  }),
  /** The saints of a date: celebrated in the calendar that day, then others whose feast it is. */
  ofDay: cache(async (calendar: CalendarCode, isoDate: string) => {
    const db = createPublicClient();
    const date = parseIsoDate(isoDate);
    if (!db || !date) return [];
    return buildSafe(async () => {
      const [saints, celebrated] = await Promise.all([listSaints(db), celebratedSaints(db, calendar, isoDate)]);
      return saintsOfDay(date, celebrated, saints);
    }, []);
  }),
};
