/**
 * Saints import: profiles, their links to calendar celebrations and related prayers.
 *
 *   pnpm import:saints --path data/import/saints/saints.json [--publish] [--dry-run]
 *
 * Run after the calendar (pnpm calendar:generate) so celebrations can be linked, and after the prayers.
 * Saints are upserted by slug and only the fields in the file are written, so Tamil biographies added
 * by editors in the admin survive a re-import.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/prayers/markup";

const saint = z.object({
  slug: z.string().regex(SLUG_PATTERN),
  name_en: z.string().min(1),
  name_ta: z.string().min(1),
  title_en: z.string().min(1).optional(),
  title_ta: z.string().min(1).optional(),
  feast: z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
  born: z.number().int().optional(),
  died: z.number().int().optional(),
  patronage_en: z.string().min(1).optional(),
  patronage_ta: z.string().min(1).optional(),
  biography_en: z.string().min(1),
  biography_ta: z.string().min(1).optional(),
  celebrations: z.array(z.string()).default([]),
  prayers: z.array(z.string()).default([]),
});

const fileSchema = z.object({
  source: z.object({
    name: z.string(),
    licenseType: z.enum(["public_domain", "licensed", "permission_granted", "original", "unknown"]),
    permissionStatus: z.enum(["verified", "pending", "restricted"]),
    attribution: z.string().optional(),
    notes: z.string().optional(),
  }),
  saints: z.array(saint).min(1),
});

async function main() {
  const { values } = parseArgs({
    options: {
      path: { type: "string" },
      publish: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  if (!values.path) {
    console.error("Usage: import:saints --path <saints.json> [--publish] [--dry-run]");
    process.exit(2);
  }
  const file = fileSchema.parse(JSON.parse(await readFile(values.path, "utf8")));
  const slugs = file.saints.map((s) => s.slug);
  const duplicate = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (duplicate) throw new Error(`Duplicate saint slug: ${duplicate}`);
  if (values["dry-run"]) {
    console.log(`Parsed ${file.saints.length} saints.`);
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const unlinked: string[] = [];

  try {
    await sql.begin(async (tx) => {
      const s = file.source;
      await tx`
        insert into public.content_sources (name, license_type, permission_status, attribution_text, notes)
        values (${s.name}, ${s.licenseType}, ${s.permissionStatus}, ${s.attribution ?? null}, ${s.notes ?? null})
        on conflict (name) do nothing`;
      const [source] = await tx<{ id: string }[]>`select id from public.content_sources where name = ${s.name}`;
      const prayers = new Map(
        (await tx<{ id: string; slug: string }[]>`select id, slug from public.prayers`).map((r) => [r.slug, r.id]),
      );

      for (const entry of file.saints) {
        const [month, day] = entry.feast.split("-").map(Number);
        const row = {
          slug: entry.slug,
          name_en: entry.name_en,
          name_ta: entry.name_ta,
          title_en: entry.title_en ?? null,
          title_ta: entry.title_ta ?? null,
          feast_month: month,
          feast_day: day,
          birth_year: entry.born ?? null,
          death_year: entry.died ?? null,
          patronage_en: entry.patronage_en ?? null,
          biography_en: entry.biography_en,
          source_id: source.id,
        };
        const optional = {
          ...(entry.patronage_ta ? { patronage_ta: entry.patronage_ta } : {}),
          ...(entry.biography_ta ? { biography_ta: entry.biography_ta } : {}),
        };
        const full = { ...row, ...optional };
        const columns = Object.keys(full).filter((k) => k !== "slug") as (keyof typeof full)[];
        const [saved] = await tx<{ id: string }[]>`
          insert into public.saints ${tx(full)}
          on conflict (slug) do update set ${tx(full, columns)}
          returning id`;

        if (entry.celebrations.length) {
          const linked = await tx<{ code: string }[]>`
            update public.celebrations set saint_id = ${saved.id}
            where code = any(${entry.celebrations}) returning code`;
          const found = new Set(linked.map((c) => c.code));
          unlinked.push(...entry.celebrations.filter((c) => !found.has(c)));
        }

        await tx`delete from public.saint_prayers where saint_id = ${saved.id}`;
        for (const [i, prayerSlug] of entry.prayers.entries()) {
          const prayerId = prayers.get(prayerSlug);
          if (!prayerId) throw new Error(`Unknown prayer ${prayerSlug} for ${entry.slug}; import prayers first`);
          await tx`insert into public.saint_prayers (saint_id, prayer_id, sort_order) values (${saved.id}, ${prayerId}, ${i})`;
        }
      }

      if (values.publish)
        await tx`update public.saints set status = 'published' where slug = any(${slugs}) and status <> 'published'`;
    });
    console.log(`Imported ${file.saints.length} saints${values.publish ? " (published)" : ""}.`);
    if (unlinked.length)
      console.warn(
        `${unlinked.length} celebrations not found (generate the calendar first): ${unlinked.slice(0, 5).join("; ")}`,
      );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
