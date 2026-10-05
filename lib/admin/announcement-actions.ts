"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isPublisher } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { optionalText, requiredText, type AdminFormState } from "./fields";
import { adminSave, formLocale } from "./save";

/** Times are entered in India time (the app's calendar), e.g. 2026-12-24T18:00. */
const toInstant = (local: string) => new Date(`${local}:00+05:30`).toISOString();

const schema = z.object({
  id: z.uuid().optional(),
  titleEn: requiredText(120),
  titleTa: requiredText(120),
  bodyEn: optionalText(400),
  bodyTa: optionalText(400),
  url: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .string()
        .regex(/^\/[a-z0-9\-/]*$/, "invalid")
        .max(200)
        .nullable(),
    ),
  scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "invalid_date"),
});

export async function saveAnnouncement(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema,
    role: "publisher",
    write: (db, a) => {
      const row = {
        kind: "announcement",
        title_en: a.titleEn,
        title_ta: a.titleTa,
        body_en: a.bodyEn,
        body_ta: a.bodyTa,
        url: a.url,
        scheduled_at: toInstant(a.scheduledAt),
      };
      // Only announcements that have not gone out can change.
      return a.id
        ? db.from("notifications").update(row).eq("id", a.id).eq("status", "scheduled").select("id").maybeSingle()
        : db.from("notifications").insert(row).select("id").single();
    },
    revalidate: () => ["/admin/notifications"],
    created: (id) => `/admin/notifications/${id}`,
  });
}

export async function cancelAnnouncement(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const locale = formLocale(formData);
  const id = z.uuid().safeParse(formData.get("id"));
  if (user && isPublisher(user.roles) && id.success) {
    const db = await createSupabaseServerClient();
    await db?.from("notifications").update({ status: "cancelled" }).eq("id", id.data).eq("status", "scheduled");
  }
  redirect(`/${locale}/admin/notifications`);
}
