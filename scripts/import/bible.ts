/**
 * Bible import CLI.
 *
 *   pnpm import:bible --preset en-drc --path ./DRC.csv [--publish] [--dry-run]
 *   pnpm import:bible --preset ta-tcb2012 --path ./Tamil-Bible-Database/MySQL [--dry-run]
 *
 * Reads DATABASE_URL (direct Postgres connection, e.g. Supabase → Settings → Database).
 * Source files are read from disk and never committed to this repository.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { applyVersification, type Scheme } from "./bible/versification";
import { parseScrollmapperCsv } from "./bible/scrollmapper-csv";
import { parseTamilMysql } from "./bible/tamil-mysql";
import { validateTranslation } from "./bible/validate";
import { loadTranslation, type SourceMeta, type TranslationMeta } from "./bible/load";
import type { ParsedTranslation } from "./bible/types";

type Preset = {
  translation: TranslationMeta;
  source: SourceMeta;
  scheme: Scheme;
  read: (path: string, sql: postgres.Sql | null) => Promise<{ parsed: ParsedTranslation; files: string[] }>;
};

const PRESETS: Record<string, Preset> = {
  "en-drc": {
    translation: {
      code: "en-drc",
      name: "Douay-Rheims Bible (Challoner Revision)",
      shortName: "Douay-Rheims",
      language: "en",
      versification: "vulgate",
      description:
        "Traditional Catholic English translation of the Latin Vulgate, revised by Bishop Challoner (1749–1752).",
    },
    source: {
      name: "Douay-Rheims Bible, Challoner revision",
      copyrightHolder: null,
      licenseType: "public_domain",
      permissionStatus: "verified",
      attribution: "Douay-Rheims Bible, Challoner revision (public domain).",
      licenseUrl: null,
      notes: "Text from github.com/scrollmapper/bible_databases (DRC, marked public domain).",
    },
    scheme: "vulgate",
    read: async (path) => {
      const parsed = parseScrollmapperCsv(await readFile(path, "utf8"));
      if (parsed.skippedBooks.length) console.log(`Skipped books outside the canon: ${parsed.skippedBooks.join(", ")}`);
      return { parsed, files: [path] };
    },
  },
  "ta-tcb2012": {
    translation: {
      code: "ta-tcb2012",
      name: "திருவிவிலியம் (பொது மொழிபெயர்ப்பு, 2012)",
      shortName: "திருவிவிலியம்",
      language: "ta",
      versification: "canonical",
      description: null,
    },
    source: {
      name: "திருவிவிலியம் — Tamil common-language Bible (2012)",
      copyrightHolder: null,
      licenseType: "unknown",
      permissionStatus: "pending",
      attribution: null,
      licenseUrl: null,
      notes:
        "Imported from github.com/jayarathina/Tamil-Bible-Database. Text rights NOT cleared: development and staff preview only until permission is obtained (see docs/CONTENT_RIGHTS.md).",
    },
    scheme: "canonical",
    read: async (dir, sql) => {
      const bookKey = join(dir, "t_bookkey.sql");
      const verses = join(dir, "t_mybibleview.sql");
      const osis = sql
        ? new Map(
            (await sql<{ osis_id: string; code: string }[]>`select osis_id, code from public.bible_books`).map((b) => [
              b.osis_id,
              b.code,
            ]),
          )
        : await osisFromSeed();
      return {
        parsed: parseTamilMysql(await readFile(bookKey, "utf8"), await readFile(verses, "utf8"), osis),
        files: [bookKey, verses],
      };
    },
  },
};

/** Offline (dry-run without a database): read the OSIS → code map from the seed file. */
async function osisFromSeed(): Promise<Map<string, string>> {
  const seed = await readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
  return new Map([...seed.matchAll(/^\s+\('([1-3]?[A-Z]{2,3})', '([^']+)', \d+,/gm)].map((m) => [m[2], m[1]]));
}

async function main() {
  const { values } = parseArgs({
    options: {
      preset: { type: "string" },
      path: { type: "string" },
      publish: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const preset = values.preset && PRESETS[values.preset];
  if (!preset || !values.path) {
    console.error(
      `Usage: import:bible --preset <${Object.keys(PRESETS).join("|")}> --path <file or dir> [--publish] [--dry-run]`,
    );
    process.exit(2);
  }

  const dryRun = values["dry-run"];
  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) throw new Error("DATABASE_URL is not set");
  const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;

  try {
    await stat(values.path);
    const { parsed, files } = await preset.read(values.path, sql);
    parsed.verses = applyVersification(preset.scheme, parsed.verses);

    const knownBooks = sql
      ? new Set((await sql<{ code: string }[]>`select code from public.bible_books`).map((b) => b.code))
      : new Set((await osisFromSeed()).values());
    const issues = validateTranslation(parsed, knownBooks);
    const errors = issues.filter((i) => i.level === "error");
    const warnings = issues.filter((i) => i.level === "warning");

    console.log(`${parsed.books.length} books, ${parsed.verses.length} verses, ${parsed.headings.length} headings`);
    console.log(`${errors.length} errors, ${warnings.length} warnings`);
    for (const issue of issues.slice(0, 40)) console.log(`  ${issue.level}: ${issue.message}`);
    if (errors.length) process.exitCode = 1;
    if (errors.length || dryRun) return;

    const hash = createHash("sha256");
    for (const file of files) hash.update(await readFile(file));
    const result = await loadTranslation(
      sql!,
      parsed,
      {
        translation: preset.translation,
        source: preset.source,
        publish: values.publish,
        fileName: files.join(", "),
        checksum: hash.digest("hex"),
      },
      warnings,
    );
    console.log(`Imported ${result.verses} verses and ${result.headings} headings (batch ${result.batchId}).`);
  } finally {
    await sql?.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
