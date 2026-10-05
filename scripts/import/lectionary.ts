/**
 * Lectionary reading-list import (references only; no reading texts).
 *
 *   pnpm import:lectionary --path <Tamil-Catholic-Lectionary>/MySQL/liturgy_lectionary_table_readings__list.sql [--dry-run]
 *
 * Upserts one lectionary set per day ID and replaces its readings and parsed verse ranges.
 * Run `pnpm calendar:generate` afterwards so days point at the sets.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { decodeReadingType, parseLectionaryReference } from "@/lib/liturgy/lectionary";
import { unescapeMysql } from "./bible/tamil-mysql";

const ROW = /^\('((?:[^'\\]|\\.)*)',\s*([\d.]+),\s*'((?:[^'\\]|\\.)*)'\)[,;]?\s*$/;

type Row = { set: string; type: string; reference: string };

export function parseReadingsList(sql: string): Row[] {
  const rows: Row[] = [];
  for (const line of sql.split("\n")) {
    const m = ROW.exec(line.trim());
    if (m)
      rows.push({
        set: unescapeMysql(m[1]).trim(),
        type: m[2],
        reference: unescapeMysql(m[3]).replace(/\s+/g, " ").trim(),
      });
  }
  return rows;
}

async function main() {
  const { values } = parseArgs({
    options: { path: { type: "string" }, "dry-run": { type: "boolean", default: false } },
  });
  if (!values.path) {
    console.error("Usage: import:lectionary --path <readings__list.sql> [--dry-run]");
    process.exit(2);
  }
  const content = await readFile(values.path, "utf8");
  const rows = parseReadingsList(content);
  const url = process.env.DATABASE_URL;
  if (!url && !values["dry-run"]) throw new Error("DATABASE_URL is not set");
  const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;

  try {
    const aliases = sql
      ? await sql<{ alias: string; code: string }[]>`
          select n.alias, b.code from public.bible_book_names n join public.bible_books b on b.id = n.book_id where n.language = 'ta'`
      : [];
    const books = new Map(aliases.map((a) => [a.alias.normalize("NFC").replace(/\s+/g, ""), a.code]));

    const issues: string[] = [];
    const decoded = rows.flatMap((row) => {
      const type = decodeReadingType(row.set, row.type);
      if (!type) {
        issues.push(`${row.set} ${row.type}: unknown reading type`);
        return [];
      }
      const ranges = sql ? parseLectionaryReference(row.reference, books) : null;
      return [{ ...row, ...type, ranges }];
    });
    const sets = [...new Set(decoded.map((d) => d.set))];
    const parsed = decoded.filter((d) => d.ranges).length;
    console.log(`${rows.length} readings in ${sets.length} sets; ${parsed} references parsed into verse ranges`);
    for (const issue of issues.slice(0, 20)) console.log(`  warning: ${issue}`);
    if (values["dry-run"] || !sql) return;

    const [batch] = await sql<{ id: string }[]>`
      insert into public.import_batches (kind, file_name, checksum, status)
      values ('lectionary', ${values.path}, ${createHash("sha256").update(content).digest("hex")}, 'running') returning id`;
    try {
      await sql.begin(async (tx) => {
        const bookIds = new Map(
          (await tx<{ id: string; code: string }[]>`select id, code from public.bible_books`).map((b) => [
            b.code,
            b.id,
          ]),
        );
        const setRows = await tx<{ id: string; code: string }[]>`
          insert into public.lectionary_sets ${tx(sets.map((code) => ({ code })))}
          on conflict (code) do update set updated_at = now()
          returning id, code`;
        const setIds = new Map(setRows.map((s) => [s.code, s.id]));
        await tx`delete from public.lectionary_readings where set_id = any(${[...setIds.values()]}::uuid[])`;

        const readingRows = decoded.map((d) => ({
          set_id: setIds.get(d.set)!,
          reading_type: d.readingType,
          sequence: d.sequence,
          alt_group: d.altGroup,
          is_short: d.isShort,
          is_proper: d.isProper,
          source_type: d.type,
          reference_display: d.reference,
        }));
        const inserted: { id: string }[] = [];
        for (let i = 0; i < readingRows.length; i += 1000) {
          inserted.push(
            ...(await tx<
              { id: string }[]
            >`insert into public.lectionary_readings ${tx(readingRows.slice(i, i + 1000))} returning id`),
          );
        }
        const rangeRows = decoded.flatMap((d, i) =>
          (d.ranges ?? []).map((r, seq) => ({
            reading_id: inserted[i].id,
            seq: seq + 1,
            book_id: bookIds.get(r.book)!,
            start_chapter: r.startChapter,
            start_verse: r.startVerse,
            start_part: r.startPart,
            end_chapter: r.endChapter,
            end_verse: r.endVerse,
            end_part: r.endPart,
          })),
        );
        for (let i = 0; i < rangeRows.length; i += 1000) {
          await tx`insert into public.lectionary_reading_ranges ${tx(rangeRows.slice(i, i + 1000))}`;
        }
      });
      await sql`update public.import_batches set status = 'succeeded', row_count = ${rows.length}, errors = ${sql.json(issues.map((message) => ({ level: "warning", message })))}, finished_at = now() where id = ${batch.id}`;
      console.log(`Imported (batch ${batch.id}).`);
    } catch (error) {
      await sql`update public.import_batches set status = 'failed', error_count = 1, errors = ${sql.json([{ level: "error", message: String(error) }])}, finished_at = now() where id = ${batch.id}`;
      throw error;
    }
  } finally {
    await sql?.end();
  }
}

if (process.argv[1]?.endsWith("lectionary.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
