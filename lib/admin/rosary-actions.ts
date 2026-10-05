"use server";

import { z } from "zod";
import { CONTENT_STATUSES, optionalText, requiredText, type AdminFormState } from "./fields";
import { adminSave } from "./save";

const schema = z.object({
  id: z.uuid(),
  titleEn: requiredText(200),
  titleTa: requiredText(200),
  scripture: optionalText(100),
  fruitEn: optionalText(120),
  fruitTa: optionalText(120),
  meditationEn: optionalText(4000),
  meditationTa: optionalText(4000),
  sourceId: z.uuid(),
  status: z.enum(CONTENT_STATUSES),
});

export async function saveMystery(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema,
    write: (db, m) =>
      db
        .from("rosary_mysteries")
        .update({
          title_en: m.titleEn,
          title_ta: m.titleTa,
          scripture_reference: m.scripture,
          fruit_en: m.fruitEn,
          fruit_ta: m.fruitTa,
          meditation_en: m.meditationEn,
          meditation_ta: m.meditationTa,
          source_id: m.sourceId,
          status: m.status,
        })
        .eq("id", m.id)
        .select("id")
        .maybeSingle(),
    revalidate: () => [
      "/rosary",
      "/rosary/joyful",
      "/rosary/luminous",
      "/rosary/sorrowful",
      "/rosary/glorious",
      "/admin/rosary",
    ],
  });
}
