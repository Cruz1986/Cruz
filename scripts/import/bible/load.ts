import type { Sql } from "postgres";
import type { ParsedTranslation } from "./types";
import type { Issue } from "./validate";

export type TranslationMeta = {
  code: string;
  name: string;
  shortName: string;
  language: "ta" | "en";
  versification: string;
  description: string | null;
};

export type SourceMeta = {
  name: string;
  copyrightHolder: string | null;
  licenseType: "public_domain" | "licensed" | "permission_granted" | "original" | "unknown";
  permissionStatus: "verified" | "pending" | "restricted";
  attribution: string | null;
  licenseUrl: string | null;
  notes: string | null;
};

const CHUNK = 2000;

/**
 * Replaces a translation's books, verses and headings in one transaction and records the
 * run in import_batches. The source row is created if missing but never modified: rights
 * decisions are made by publishers in the admin, not by import scripts.
 */
export async function loadTranslation(
  sql: Sql,
  parsed: ParsedTranslation,
  meta: { translation: TranslationMeta; source: SourceMeta; publish: boolean; fileName: string; checksum: string },
  warnings: Issue[],
): Promise<{ batchId: string; verses: number; headings: number }> {
  const [batch] = await sql<{ id: string }[]>`
    insert into public.import_batches (kind, file_name, checksum, status)
    values ('bible', ${meta.fileName}, ${meta.checksum}, 'running')
    returning id`;

  try {
    const result = await sql.begin(async (tx) => {
      await tx`
        insert into public.content_sources
          (name, copyright_holder, license_type, permission_status, attribution_text, license_url, notes)
        values (${meta.source.name}, ${meta.source.copyrightHolder}, ${meta.source.licenseType},
                ${meta.source.permissionStatus}, ${meta.source.attribution}, ${meta.source.licenseUrl}, ${meta.source.notes})
        on conflict (name) do nothing`;
      const [source] = await tx<
        { id: string }[]
      >`select id from public.content_sources where name = ${meta.source.name}`;
      await tx`update public.import_batches set source_id = ${source.id} where id = ${batch.id}`;

      const t = meta.translation;
      const [translation] = await tx<{ id: string }[]>`
        insert into public.bible_translations (code, name, short_name, language, versification, description, source_id)
        values (${t.code}, ${t.name}, ${t.shortName}, ${t.language}, ${t.versification}, ${t.description}, ${source.id})
        on conflict (code) do update set
          name = excluded.name, short_name = excluded.short_name, language = excluded.language,
          versification = excluded.versification, description = excluded.description, source_id = excluded.source_id
        returning id`;

      const books = await tx<{ id: string; code: string; canon_order: number }[]>`
        select id, code, canon_order from public.bible_books`;
      const byCode = new Map(books.map((b) => [b.code, b]));
      const book = (code: string) => {
        const found = byCode.get(code);
        if (!found) throw new Error(`Unknown book ${code}`);
        return found;
      };

      await tx`delete from public.bible_section_headings where translation_id = ${translation.id}`;
      await tx`delete from public.bible_verses where translation_id = ${translation.id}`;
      await tx`delete from public.bible_translation_books where translation_id = ${translation.id}`;

      await tx`insert into public.bible_translation_books ${tx(
        parsed.books.map((b) => ({
          translation_id: translation.id,
          book_id: book(b.book).id,
          sort_order: b.order,
          intro: b.intro,
        })),
      )}`;

      const ordinals = new Map<string, number>();
      const verseRows = parsed.verses.map((v) => {
        const key = `${v.book}.${v.chapter}`;
        const ordinal = (ordinals.get(key) ?? 0) + 1;
        ordinals.set(key, ordinal);
        const c = v.canonical ?? v;
        return {
          translation_id: translation.id,
          book_id: book(v.book).id,
          chapter: v.chapter,
          verse: v.verse,
          verse_part: v.part,
          verse_label: v.label,
          ordinal,
          text: v.text,
          is_poetry: v.isPoetry,
          paragraph_end: v.paragraphEnd,
          canonical_vkey: book(c.book).canon_order * 1_000_000 + c.chapter * 1000 + c.verse,
        };
      });
      for (let i = 0; i < verseRows.length; i += CHUNK) {
        await tx`insert into public.bible_verses ${tx(verseRows.slice(i, i + CHUNK))}`;
      }

      const headingOrder = new Map<string, number>();
      const headingRows = parsed.headings.map((h) => {
        const key = `${h.book}.${h.chapter}.${h.beforeVerse}`;
        const sortOrder = headingOrder.get(key) ?? 0;
        headingOrder.set(key, sortOrder + 1);
        return {
          translation_id: translation.id,
          book_id: book(h.book).id,
          chapter: h.chapter,
          before_verse: h.beforeVerse,
          level: h.level,
          text: h.text,
          sort_order: sortOrder,
        };
      });
      for (let i = 0; i < headingRows.length; i += CHUNK) {
        await tx`insert into public.bible_section_headings ${tx(headingRows.slice(i, i + CHUNK))}`;
      }

      if (meta.publish) {
        // The publish guard rejects this unless the source is verified with a known licence.
        await tx`update public.bible_translations set status = 'published' where id = ${translation.id}`;
      }

      return { verses: verseRows.length, headings: headingRows.length };
    });

    await sql`
      update public.import_batches
      set status = 'succeeded', row_count = ${result.verses + result.headings},
          error_count = 0, errors = ${sql.json(warnings)}, finished_at = now()
      where id = ${batch.id}`;
    return { batchId: batch.id, ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      update public.import_batches
      set status = 'failed', error_count = 1, errors = ${sql.json([{ level: "error", message }])}, finished_at = now()
      where id = ${batch.id}`;
    throw error;
  }
}
