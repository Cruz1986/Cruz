"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isPublisher } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { parseLectionaryReference } from "@/lib/liturgy/lectionary";
import { checkbox, dbErrorStatus, fieldErrors, optionalText, requiredText, type AdminFormState } from "./fields";
import { adminSave, revalidateAll } from "./save";

const COLORS = ["green", "violet", "white", "red", "rose", "black", "gold"] as const;

const daySchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  titleEn: requiredText(300),
  titleTa: requiredText(300),
  color: z.enum(COLORS),
  notesEn: optionalText(2000),
  notesTa: optionalText(2000),
  isOverride: checkbox,
});

/** A day's title, colour and notes. With "keep", regenerating the calendar leaves the day as edited. */
export async function saveDay(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema: daySchema,
    role: "publisher",
    write: (db, d) =>
      db
        .from("liturgical_days")
        .update({
          title_en: d.titleEn,
          title_ta: d.titleTa,
          color: d.color,
          notes_en: d.notesEn,
          notes_ta: d.notesTa,
          is_override: d.isOverride,
        })
        .eq("id", d.id)
        .select("id")
        .maybeSingle(),
    revalidate: (d) => ["/", "/today", `/today/${d.date}`, "/calendar", `/calendar/${d.date.slice(0, 7)}`],
  });
}

const celebrationSchema = z.object({
  id: z.uuid(),
  nameEn: requiredText(300),
  nameTa: requiredText(300),
  color: z.enum(COLORS),
  saintId: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid().nullable()),
});

/** A celebration's names (kept when the calendar is regenerated), colour and saint. */
export async function saveCelebration(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema: celebrationSchema,
    role: "publisher",
    write: (db, c) =>
      db
        .from("celebrations")
        .update({ name_en: c.nameEn, name_ta: c.nameTa, color: c.color, saint_id: c.saintId, names_locked: true })
        .eq("id", c.id)
        .select("id")
        .maybeSingle(),
    revalidate: () => ["*"],
  });
}

const readingSchema = z.object({ id: z.uuid(), reference: requiredText(200) });

/**
 * Corrects a reading's reference. The text is read like the lectionary data ("எசா58:7-10",
 * "Isa 58:7-10"); its verse ranges are replaced and the reading is kept on re-import.
 */
export async function saveReading(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const user = await getSessionUser();
  if (!user || !isPublisher(user.roles)) return { status: "forbidden" };
  const parsed = readingSchema.safeParse({ id: formData.get("id"), reference: formData.get("reference") });
  if (!parsed.success) return { status: "invalid", fieldErrors: fieldErrors(parsed.error) };

  const db = await createSupabaseServerClient();
  if (!db) return { status: "failed" };
  // Every spelling the lectionary or an editor may use: aliases, plus each book's code, names and abbreviations.
  const [names, bookRows] = await Promise.all([
    db.from("bible_book_names").select("alias, bible_books!inner(code)").limit(5000),
    db.from("bible_books").select("code, name_en, name_ta, abbr_en, abbr_ta"),
  ]);
  if (names.error || bookRows.error) return { status: "failed" };
  const key = (s: string) => s.normalize("NFC").replace(/\s+/g, "");
  const books = new Map<string, string>();
  for (const b of z
    .array(
      z.object({
        code: z.string(),
        name_en: z.string(),
        name_ta: z.string(),
        abbr_en: z.string(),
        abbr_ta: z.string(),
      }),
    )
    .parse(bookRows.data))
    for (const spelling of [b.code, b.name_en, b.name_ta, b.abbr_en, b.abbr_ta]) books.set(key(spelling), b.code);
  for (const n of z
    .array(z.object({ alias: z.string(), bible_books: z.object({ code: z.string() }) }))
    .parse(names.data))
    books.set(key(n.alias), n.bible_books.code);
  const ranges = parseLectionaryReference(parsed.data.reference, books);
  if (!ranges) return { status: "invalid", fieldErrors: { reference: "invalid_reference" } };

  const { error } = await db.rpc("admin_set_reading_reference", {
    p_reading_id: parsed.data.id,
    p_reference: parsed.data.reference,
    p_ranges: ranges.map((r) => ({
      book: r.book,
      start_chapter: r.startChapter,
      start_verse: r.startVerse,
      start_part: r.startPart,
      end_chapter: r.endChapter,
      end_verse: Math.min(r.endVerse, 999),
      end_part: r.endPart,
    })),
  });
  if (error) return { status: dbErrorStatus(error) };
  revalidateAll(["*"]);
  return { status: "saved" };
}
