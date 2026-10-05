/**
 * Prayer import.
 *
 *   pnpm import:prayers --path data/import/prayers/traditional-en.json [--publish] [--dry-run]
 *
 * Upserts prayers by slug. Only the fields present in the file are written, so Tamil texts
 * added by editors are kept when the English file is re-imported. The content source is
 * created if missing but never changed.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/prayers/markup";

const fileSchema = z.object({
  source: z.object({
    name: z.string().min(1),
    licenseType: z.enum(["public_domain", "licensed", "permission_granted", "original", "unknown"]),
    permissionStatus: z.enum(["verified", "pending", "restricted"]),
    attribution: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  prayers: z
    .array(
      z
        .object({
          slug: z.string().regex(SLUG_PATTERN),
          category: z.string(),
          sort: z.number().int().default(0),
          title_en: z.string().min(1).optional(),
          body_en: z.string().min(1).optional(),
          title_ta: z.string().min(1).optional(),
          body_ta: z.string().min(1).optional(),
        })
        .refine((p) => (p.title_en && p.body_en) || (p.title_ta && p.body_ta), "each prayer needs a complete language"),
    )
    .min(1),
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
    console.error("Usage: import:prayers --path <file.json> [--publish] [--dry-run]");
    process.exit(2);
  }
  const file = fileSchema.parse(JSON.parse(await readFile(values.path, "utf8")));
  const slugs = file.prayers.map((p) => p.slug);
  const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (duplicates.length) throw new Error(`Duplicate slugs: ${duplicates.join(", ")}`);
  console.log(`${file.prayers.length} prayers in ${new Set(file.prayers.map((p) => p.category)).size} categories`);
  if (values["dry-run"]) return;

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
      const categories = new Map(
        (await tx<{ id: string; slug: string }[]>`select id, slug from public.prayer_categories`).map((c) => [
          c.slug,
          c.id,
        ]),
      );

      for (const p of file.prayers) {
        const category = categories.get(p.category);
        if (!category) throw new Error(`${p.slug}: unknown category ${p.category}`);
        const fields = {
          category_id: category,
          sort_order: p.sort,
          source_id: source.id,
          ...(p.title_en ? { title_en: p.title_en, body_en: p.body_en } : {}),
          ...(p.title_ta ? { title_ta: p.title_ta, body_ta: p.body_ta } : {}),
        };
        const columns = Object.keys(fields) as (keyof typeof fields)[];
        await tx`
          insert into public.prayers ${tx({ slug: p.slug, ...fields }, "slug", ...columns)}
          on conflict (slug) do update set ${tx(fields, ...columns)}`;
      }
      if (values.publish) {
        await tx`update public.prayers set status = 'published' where slug = any(${slugs}) and status <> 'published'`;
      }
    });
    console.log(`Imported${values.publish ? " and published" : ""}.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
