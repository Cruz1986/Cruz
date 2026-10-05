"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isPublisher } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { CONTENT_STATUSES, optionalText, type AdminFormState } from "./fields";
import { MEDIA_BUCKET, mediaRecordSchema } from "./media";
import { adminSave, formLocale, revalidateAll } from "./save";
import { redirect } from "next/navigation";

const details = {
  altEn: optionalText(300),
  altTa: optionalText(300),
  attribution: optionalText(500),
  sourceId: z.uuid(),
  status: z.enum(CONTENT_STATUSES),
};
const needsAlt = (m: { altEn: string | null; altTa: string | null }) => Boolean(m.altEn || m.altTa);

const createSchema = z
  .object({ ...details })
  .and(mediaRecordSchema)
  .refine(needsAlt, { message: "required", path: ["altEn"] });

/** Records an image the browser has uploaded to storage. */
export async function createMedia(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema: createSchema,
    write: (db, m) =>
      db
        .from("media")
        .insert({
          kind: "image",
          storage_path: m.storagePath,
          mime_type: m.mimeType,
          bytes: m.bytes,
          width: m.width,
          height: m.height,
          alt_en: m.altEn,
          alt_ta: m.altTa,
          attribution_text: m.attribution,
          source_id: m.sourceId,
          status: m.status,
        })
        .select("id")
        .single(),
    revalidate: () => ["/admin/media"],
    created: (id) => `/admin/media/${id}`,
  });
}

const updateSchema = z.object({ id: z.uuid(), ...details }).refine(needsAlt, { message: "required", path: ["altEn"] });

/** Alt text, credit, source and status of an image. Pages showing it (saints) refresh. */
export async function saveMedia(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema: updateSchema,
    write: (db, m) =>
      db
        .from("media")
        .update({
          alt_en: m.altEn,
          alt_ta: m.altTa,
          attribution_text: m.attribution,
          source_id: m.sourceId,
          status: m.status,
        })
        .eq("id", m.id)
        .select("id")
        .maybeSingle(),
    revalidate: () => ["/saints", "/admin/media"],
  });
}

/** Deletes the record and the stored file (publishers). Saints using it lose their image. */
export async function deleteMedia(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const locale = formLocale(formData);
  const id = z.uuid().safeParse(formData.get("id"));
  if (user && isPublisher(user.roles) && id.success) {
    const db = await createSupabaseServerClient();
    const { data } = (await db?.from("media").delete().eq("id", id.data).select("storage_path").maybeSingle()) ?? {};
    if (data && db) {
      await db.storage.from(MEDIA_BUCKET).remove([String(data.storage_path)]);
      revalidateAll(["/saints", "/admin/media"]);
    }
  }
  redirect(`/${locale}/admin/media`);
}
