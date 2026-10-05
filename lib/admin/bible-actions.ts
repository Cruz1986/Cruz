"use server";

import { z } from "zod";
import { CONTENT_STATUSES, optionalInt, optionalText, requiredText, type AdminFormState } from "./fields";
import { adminSave } from "./save";

const translationSchema = z.object({
  id: z.uuid(),
  name: requiredText(200),
  shortName: requiredText(40),
  description: optionalText(2000),
  sortOrder: optionalInt(0, 999),
  sourceId: z.uuid(),
  status: z.enum(CONTENT_STATUSES),
});

/** Translation details and status (publishing needs a verified source, enforced by the database). */
export async function saveTranslation(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema: translationSchema,
    write: (db, tr) =>
      db
        .from("bible_translations")
        .update({
          name: tr.name,
          short_name: tr.shortName,
          description: tr.description,
          sort_order: tr.sortOrder ?? 0,
          source_id: tr.sourceId,
          status: tr.status,
        })
        .eq("id", tr.id)
        .select("id")
        .maybeSingle(),
    revalidate: () => ["*"],
  });
}

const bookSchema = z.object({
  id: z.uuid(),
  nameEn: requiredText(80),
  nameTa: requiredText(80),
  fullNameTa: requiredText(160),
  abbrEn: requiredText(12),
  abbrTa: requiredText(12),
});

/** Book names and abbreviations used across the app (publishers). */
export async function saveBook(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema: bookSchema,
    role: "publisher",
    write: (db, b) =>
      db
        .from("bible_books")
        .update({
          name_en: b.nameEn,
          name_ta: b.nameTa,
          full_name_ta: b.fullNameTa,
          abbr_en: b.abbrEn,
          abbr_ta: b.abbrTa,
        })
        .eq("id", b.id)
        .select("id")
        .maybeSingle(),
    revalidate: () => ["*"],
  });
}
