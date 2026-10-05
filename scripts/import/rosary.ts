/**
 * Rosary import: mysteries (titles, Scripture, fruits, meditations) and the guided sequence.
 *
 *   pnpm import:rosary --path data/import/rosary/rosary.json [--publish]
 *
 * Needs the prayers the sequence refers to (pnpm import:prayers) and the seeded mystery sets.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { z } from "zod";

const mystery = z.object({
  title_en: z.string().min(1),
  title_ta: z.string().min(1),
  scripture: z.string().min(1),
  fruit_en: z.string().min(1),
  fruit_ta: z.string().min(1),
  meditation_en: z.string().min(1),
  meditation_ta: z.string().min(1).optional(),
});

const fileSchema = z.object({
  source: z.object({
    name: z.string(),
    licenseType: z.enum(["public_domain", "licensed", "permission_granted", "original", "unknown"]),
    permissionStatus: z.enum(["verified", "pending", "restricted"]),
    attribution: z.string().optional(),
    notes: z.string().optional(),
  }),
  steps: z.array(
    z.object({
      phase: z.enum(["opening", "decade", "closing"]),
      prayer: z.string().nullable(),
      repeat: z.number().int().min(1).max(10),
      label_en: z.string().optional(),
      label_ta: z.string().optional(),
    }),
  ),
  mysteries: z.record(z.enum(["joyful", "luminous", "sorrowful", "glorious"]), z.array(mystery).length(5)),
});

async function main() {
  const { values } = parseArgs({ options: { path: { type: "string" }, publish: { type: "boolean", default: false } } });
  if (!values.path) {
    console.error("Usage: import:rosary --path <rosary.json> [--publish]");
    process.exit(2);
  }
  const file = fileSchema.parse(JSON.parse(await readFile(values.path, "utf8")));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await sql.begin(async (tx) => {
      const s = file.source;
      await tx`
        insert into public.content_sources (name, license_type, permission_status, attribution_text, notes)
        values (${s.name}, ${s.licenseType}, ${s.permissionStatus}, ${s.attribution ?? null}, ${s.notes ?? null})
        on conflict (name) do nothing`;
      const [source] = await tx<{ id: string }[]>`select id from public.content_sources where name = ${s.name}`;
      const sets = new Map(
        (await tx<{ id: string; key: string }[]>`select id, key from public.rosary_mystery_sets`).map((r) => [
          r.key,
          r.id,
        ]),
      );
      const prayers = new Map(
        (await tx<{ id: string; slug: string }[]>`select id, slug from public.prayers`).map((r) => [r.slug, r.id]),
      );

      for (const [key, list] of Object.entries(file.mysteries)) {
        const setId = sets.get(key);
        if (!setId) throw new Error(`Mystery set ${key} is not seeded`);
        for (const [i, m] of list.entries()) {
          const row = {
            set_id: setId,
            number: i + 1,
            title_en: m.title_en,
            title_ta: m.title_ta,
            scripture_reference: m.scripture,
            fruit_en: m.fruit_en,
            fruit_ta: m.fruit_ta,
            meditation_en: m.meditation_en,
            meditation_ta: m.meditation_ta ?? null,
            source_id: source.id,
          };
          await tx`
            insert into public.rosary_mysteries ${tx(row)}
            on conflict (set_id, number) do update set ${tx(row, "title_en", "title_ta", "scripture_reference", "fruit_en", "fruit_ta", "meditation_en", "meditation_ta", "source_id")}`;
        }
      }

      await tx`delete from public.rosary_steps`;
      const sequence: Record<string, number> = {};
      const steps = file.steps.map((step) => {
        if (step.prayer && !prayers.has(step.prayer))
          throw new Error(`Unknown prayer ${step.prayer}; import prayers first`);
        sequence[step.phase] = (sequence[step.phase] ?? 0) + 1;
        return {
          phase: step.phase,
          sequence: sequence[step.phase],
          prayer_id: step.prayer ? prayers.get(step.prayer)! : null,
          repeat_count: step.repeat,
          label_en: step.label_en ?? null,
          label_ta: step.label_ta ?? null,
        };
      });
      await tx`insert into public.rosary_steps ${tx(steps)}`;
      if (values.publish) await tx`update public.rosary_mysteries set status = 'published' where status <> 'published'`;
    });
    console.log(`Imported 20 mysteries and ${file.steps.length} steps${values.publish ? " (published)" : ""}.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
