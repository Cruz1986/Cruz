"use server";

import { z } from "zod";
import { CONTENT_STATUSES, requiredText, type AdminFormState } from "./fields";
import { createSupabaseServerClient } from "@/lib/db/server";
import { adminDelete, adminSave } from "./save";

const schema = z.object({
  id: z.uuid().optional(),
  date: z.iso.date({ message: "invalid_date" }),
  language: z.enum(["ta", "en"]),
  title: requiredText(200),
  body: requiredText(20_000),
  author: requiredText(200),
  sourceId: z.uuid(),
  status: z.enum(CONTENT_STATUSES),
});

export async function saveReflection(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema,
    write: (db, r) => {
      const row = {
        reflection_date: r.date,
        language: r.language,
        title: r.title,
        body: r.body,
        author: r.author,
        source_id: r.sourceId,
        status: r.status,
      };
      return r.id
        ? db.from("reflections").update(row).eq("id", r.id).select("id").maybeSingle()
        : db.from("reflections").insert(row).select("id").single();
    },
    revalidate: (r) => ["/", "/today", `/today/${r.date}`, "/admin/reflections"],
    created: (id) => `/admin/reflections/${id}`,
  });
}

export async function deleteReflection(formData: FormData) {
  // The day's page must be refreshed too, so look up its date first.
  const id = z.uuid().safeParse(formData.get("id"));
  const db = await createSupabaseServerClient();
  const { data } =
    id.success && db
      ? await db.from("reflections").select("reflection_date").eq("id", id.data).maybeSingle()
      : { data: null };
  const day = data ? [`/today/${String(data.reflection_date)}`] : [];
  await adminDelete(formData, "reflections", "/admin/reflections", ["/", "/today", ...day, "/admin/reflections"]);
}
