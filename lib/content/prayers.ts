import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient, type DbClient } from "@/lib/db/public";
import { buildSafe } from "./build-safe";

export type PrayerCategory = { id: string; slug: string; nameEn: string; nameTa: string; sortOrder: number };
export type PrayerSummary = {
  id: string;
  slug: string;
  categoryId: string;
  titleEn: string | null;
  titleTa: string | null;
  sortOrder: number;
  hasEn: boolean;
  hasTa: boolean;
};
export type Prayer = PrayerSummary & {
  bodyEn: string | null;
  bodyTa: string | null;
  sourceId: string;
  status: "draft" | "in_review" | "published" | "archived";
  updatedAt: string;
};

const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name_en: z.string(),
  name_ta: z.string(),
  sort_order: z.number(),
});
const prayerSchema = z.object({
  id: z.string(),
  slug: z.string(),
  category_id: z.string(),
  title_en: z.string().nullable(),
  title_ta: z.string().nullable(),
  body_en: z.string().nullable(),
  body_ta: z.string().nullable(),
  sort_order: z.number(),
  source_id: z.string(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  updated_at: z.string(),
});

function toPrayer(row: z.infer<typeof prayerSchema>): Prayer {
  return {
    id: row.id,
    slug: row.slug,
    categoryId: row.category_id,
    titleEn: row.title_en,
    titleTa: row.title_ta,
    bodyEn: row.body_en,
    bodyTa: row.body_ta,
    sortOrder: row.sort_order,
    sourceId: row.source_id,
    status: row.status,
    updatedAt: row.updated_at,
    hasEn: Boolean(row.title_en && row.body_en),
    hasTa: Boolean(row.title_ta && row.body_ta),
  };
}

const PRAYER_COLUMNS =
  "id, slug, category_id, title_en, title_ta, body_en, body_ta, sort_order, source_id, status, updated_at";

export async function listCategories(db: DbClient): Promise<PrayerCategory[]> {
  const { data, error } = await db
    .from("prayer_categories")
    .select("id, slug, name_en, name_ta, sort_order")
    .order("sort_order");
  if (error) throw new Error(`Failed to load prayer categories: ${error.message}`);
  return z
    .array(categorySchema)
    .parse(data)
    .map((c) => ({ id: c.id, slug: c.slug, nameEn: c.name_en, nameTa: c.name_ta, sortOrder: c.sort_order }));
}

/** Prayers visible to the client (published only for the public client; all for staff). */
export async function listPrayers(db: DbClient): Promise<Prayer[]> {
  const { data, error } = await db.from("prayers").select(PRAYER_COLUMNS).order("sort_order").order("slug");
  if (error) throw new Error(`Failed to load prayers: ${error.message}`);
  return z.array(prayerSchema).parse(data).map(toPrayer);
}

export async function getPrayerBy(db: DbClient, field: "slug" | "id", value: string): Promise<Prayer | null> {
  const { data, error } = await db.from("prayers").select(PRAYER_COLUMNS).eq(field, value).maybeSingle();
  if (error) throw new Error(`Failed to load prayer: ${error.message}`);
  return data ? toPrayer(prayerSchema.parse(data)) : null;
}

export function prayerTitle(p: Pick<PrayerSummary, "titleEn" | "titleTa">, locale: string): string {
  return (locale === "ta" ? (p.titleTa ?? p.titleEn) : (p.titleEn ?? p.titleTa)) ?? "";
}

export const publicPrayers = {
  categories: cache(async () => {
    const db = createPublicClient();
    return db ? buildSafe(() => listCategories(db), []) : [];
  }),
  list: cache(async () => {
    const db = createPublicClient();
    return db ? buildSafe(() => listPrayers(db), []) : [];
  }),
  bySlug: cache(async (slug: string) => {
    const db = createPublicClient();
    return db ? buildSafe(() => getPrayerBy(db, "slug", slug), null) : null;
  }),
};
