import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient, type DbClient } from "@/lib/db/public";
import type { MysterySetKey, RosaryStepConfig } from "@/lib/rosary/sequence";
import { buildSafe } from "./build-safe";

export type MysterySet = { key: MysterySetKey; nameEn: string; nameTa: string; weekdays: number[] };
export type Mystery = {
  number: number;
  titleEn: string;
  titleTa: string;
  scripture: string | null;
  fruitEn: string | null;
  fruitTa: string | null;
  meditationEn: string | null;
  meditationTa: string | null;
  sourceId: string;
};
export type RosaryPrayer = {
  slug: string;
  titleEn: string | null;
  titleTa: string | null;
  bodyEn: string | null;
  bodyTa: string | null;
};
export type RosaryData = {
  sets: MysterySet[];
  mysteries: Record<MysterySetKey, Mystery[]>;
  steps: RosaryStepConfig[];
  prayers: Record<string, RosaryPrayer>;
};

const setSchema = z.object({
  id: z.string(),
  key: z.enum(["joyful", "luminous", "sorrowful", "glorious"]),
  name_en: z.string(),
  name_ta: z.string(),
  weekdays: z.array(z.number()),
});
const mysterySchema = z.object({
  set_id: z.string(),
  number: z.number(),
  title_en: z.string(),
  title_ta: z.string(),
  scripture_reference: z.string().nullable(),
  fruit_en: z.string().nullable(),
  fruit_ta: z.string().nullable(),
  meditation_en: z.string().nullable(),
  meditation_ta: z.string().nullable(),
  source_id: z.string(),
});
const stepSchema = z.object({
  phase: z.enum(["opening", "decade", "closing"]),
  sequence: z.number(),
  repeat_count: z.number(),
  label_en: z.string().nullable(),
  label_ta: z.string().nullable(),
  prayer_id: z.string().nullable(),
  prayers: z
    .object({
      slug: z.string(),
      title_en: z.string().nullable(),
      title_ta: z.string().nullable(),
      body_en: z.string().nullable(),
      body_ta: z.string().nullable(),
    })
    .nullable(),
});

const PHASES = ["opening", "decade", "closing"] as const;

export async function getRosaryData(db: DbClient): Promise<RosaryData | null> {
  const [sets, mysteries, steps] = await Promise.all([
    db.from("rosary_mystery_sets").select("id, key, name_en, name_ta, weekdays").order("sort_order"),
    db
      .from("rosary_mysteries")
      .select(
        "set_id, number, title_en, title_ta, scripture_reference, fruit_en, fruit_ta, meditation_en, meditation_ta, source_id",
      )
      .order("number"),
    db
      .from("rosary_steps")
      .select(
        "phase, sequence, repeat_count, label_en, label_ta, prayer_id, prayers(slug, title_en, title_ta, body_en, body_ta)",
      ),
  ]);
  for (const r of [sets, mysteries, steps])
    if (r.error) throw new Error(`Failed to load the Rosary: ${r.error.message}`);

  const setRows = z.array(setSchema).parse(sets.data);
  const stepRows = z
    .array(stepSchema)
    .parse(steps.data)
    .sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || a.sequence - b.sequence);
  const keyOf = new Map(setRows.map((s) => [s.id, s.key]));
  const grouped = { joyful: [], luminous: [], sorrowful: [], glorious: [] } as Record<MysterySetKey, Mystery[]>;
  for (const m of z.array(mysterySchema).parse(mysteries.data)) {
    const key = keyOf.get(m.set_id);
    if (!key) continue;
    grouped[key].push({
      number: m.number,
      titleEn: m.title_en,
      titleTa: m.title_ta,
      scripture: m.scripture_reference,
      fruitEn: m.fruit_en,
      fruitTa: m.fruit_ta,
      meditationEn: m.meditation_en,
      meditationTa: m.meditation_ta,
      sourceId: m.source_id,
    });
  }

  // A step whose prayer is not visible (unpublished) cannot be prayed: the Rosary is unavailable.
  if (stepRows.length === 0 || stepRows.some((s) => s.prayer_id !== null && s.prayers === null)) return null;
  if (Object.values(grouped).some((list) => list.length !== 5)) return null;

  const prayers: Record<string, RosaryPrayer> = {};
  for (const s of stepRows) {
    if (s.prayers)
      prayers[s.prayers.slug] = {
        slug: s.prayers.slug,
        titleEn: s.prayers.title_en,
        titleTa: s.prayers.title_ta,
        bodyEn: s.prayers.body_en,
        bodyTa: s.prayers.body_ta,
      };
  }
  return {
    sets: setRows.map((s) => ({ key: s.key, nameEn: s.name_en, nameTa: s.name_ta, weekdays: s.weekdays })),
    mysteries: grouped,
    steps: stepRows.map((s) => ({
      phase: s.phase,
      prayerSlug: s.prayers?.slug ?? null,
      repeat: s.repeat_count,
      labelEn: s.label_en,
      labelTa: s.label_ta,
    })),
    prayers,
  };
}

export const publicRosary = cache(async () => {
  const db = createPublicClient();
  return db ? buildSafe(() => getRosaryData(db), null) : null;
});
