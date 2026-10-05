import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/prayers/markup";
import { CONTENT_STATUSES } from "./prayer-form";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const optionalInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable());

export const saintFormSchema = z
  .object({
    id: z.uuid().optional(),
    slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN).max(80),
    sourceId: z.uuid(),
    status: z.enum(CONTENT_STATUSES),
    nameEn: z.string().trim().min(1).max(200),
    nameTa: z.string().trim().min(1).max(200),
    titleEn: optionalText(200),
    titleTa: optionalText(200),
    feastMonth: optionalInt(1, 12),
    feastDay: optionalInt(1, 31),
    birthYear: optionalInt(-100, 2100),
    deathYear: optionalInt(1, 2100),
    patronageEn: optionalText(300),
    patronageTa: optionalText(300),
    biographyEn: optionalText(20_000),
    biographyTa: optionalText(20_000),
  })
  .refine((s) => (s.feastMonth === null) === (s.feastDay === null), { message: "feast_incomplete", path: ["feastDay"] })
  .refine(
    (s) =>
      s.feastMonth === null ||
      s.feastDay === null ||
      new Date(Date.UTC(2000, s.feastMonth - 1, s.feastDay)).getUTCMonth() === s.feastMonth - 1,
    { message: "feast_invalid", path: ["feastDay"] },
  )
  .refine((s) => s.birthYear === null || s.deathYear === null || s.birthYear <= s.deathYear, {
    message: "years_order",
    path: ["deathYear"],
  })
  .refine((s) => s.status !== "published" || s.biographyEn || s.biographyTa, {
    message: "biography_required",
    path: ["biographyEn"],
  });

export type SaintFormValues = z.infer<typeof saintFormSchema>;

const FIELDS = [
  "slug",
  "sourceId",
  "status",
  "nameEn",
  "nameTa",
  "titleEn",
  "titleTa",
  "feastMonth",
  "feastDay",
  "birthYear",
  "deathYear",
  "patronageEn",
  "patronageTa",
  "biographyEn",
  "biographyTa",
] as const;

export function parseSaintForm(formData: FormData) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return saintFormSchema.safeParse({
    id: field("id") || undefined,
    ...Object.fromEntries(FIELDS.map((f) => [f, field(f)])),
  });
}

/** The database row for a valid form. */
export function saintRow(s: SaintFormValues) {
  return {
    slug: s.slug,
    source_id: s.sourceId,
    status: s.status,
    name_en: s.nameEn,
    name_ta: s.nameTa,
    title_en: s.titleEn,
    title_ta: s.titleTa,
    feast_month: s.feastMonth,
    feast_day: s.feastDay,
    birth_year: s.birthYear,
    death_year: s.deathYear,
    patronage_en: s.patronageEn,
    patronage_ta: s.patronageTa,
    biography_en: s.biographyEn,
    biography_ta: s.biographyTa,
  };
}
