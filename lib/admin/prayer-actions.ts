"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isPublisher, isStaff } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { routing } from "@/lib/i18n/routing";
import { allowedStatuses, parsePrayerForm, prayerErrorCode } from "./prayer-form";

export type PrayerFormState = {
  status: "idle" | "saved" | "invalid" | "slug_taken" | "source_not_cleared" | "forbidden" | "failed";
  fieldErrors?: Record<string, string>;
};

function revalidatePrayer(slug: string) {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/prayers`);
    revalidatePath(`/${locale}/prayers/${slug}`);
    revalidatePath(`/${locale}/admin/prayers`);
  }
}

/** Creates or updates a prayer. Authorised here, then again by row level security. */
export async function savePrayer(_prev: PrayerFormState, formData: FormData): Promise<PrayerFormState> {
  const user = await getSessionUser();
  if (!user || !isStaff(user.roles)) return { status: "forbidden" };

  const parsed = parsePrayerForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "invalid", fieldErrors };
  }
  const p = parsed.data;
  if (!allowedStatuses(user.roles).includes(p.status)) return { status: "forbidden" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "failed" };
  const row = {
    slug: p.slug,
    category_id: p.categoryId,
    source_id: p.sourceId,
    sort_order: p.sortOrder,
    status: p.status,
    title_en: p.titleEn,
    body_en: p.bodyEn,
    title_ta: p.titleTa,
    body_ta: p.bodyTa,
  };

  const result = p.id
    ? await supabase.from("prayers").update(row).eq("id", p.id).select("id, slug").maybeSingle()
    : await supabase.from("prayers").insert(row).select("id, slug").single();
  if (result.error) return { status: prayerErrorCode(result.error.code) };
  // An update that matched no row means RLS hid it (e.g. an editor editing published content).
  if (!result.data) return { status: "forbidden" };

  revalidatePrayer(result.data.slug);
  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(formData.get("locale"));
  if (!p.id) redirect(`/${locale}/admin/prayers/${result.data.id}`);
  return { status: "saved" };
}

export async function deletePrayer(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(formData.get("locale"));
  const id = z.uuid().safeParse(formData.get("id"));
  if (!user || !isPublisher(user.roles) || !id.success) redirect(`/${locale}/admin/prayers`);

  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.from("prayers").delete().eq("id", id.data).select("slug").maybeSingle()) ?? {};
  if (data) revalidatePrayer(data.slug);
  redirect(`/${locale}/admin/prayers`);
}
