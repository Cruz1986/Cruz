"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { isPublisher, isStaff } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { routing } from "@/lib/i18n/routing";
import { allowedStatuses, prayerErrorCode } from "./prayer-form";
import { parseSaintForm, saintRow } from "./saint-form";

export type SaintFormState = {
  status: "idle" | "saved" | "invalid" | "slug_taken" | "source_not_cleared" | "forbidden" | "failed";
  fieldErrors?: Record<string, string>;
};

function revalidateSaint(slug: string) {
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/saints`);
    revalidatePath(`/${locale}/saints/${slug}`);
    revalidatePath(`/${locale}/admin/saints`);
  }
}

/** Creates or updates a saint. Authorised here, then again by row level security. */
export async function saveSaint(_prev: SaintFormState, formData: FormData): Promise<SaintFormState> {
  const user = await getSessionUser();
  if (!user || !isStaff(user.roles)) return { status: "forbidden" };

  const parsed = parseSaintForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "invalid", fieldErrors };
  }
  const s = parsed.data;
  if (!allowedStatuses(user.roles).includes(s.status)) return { status: "forbidden" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "failed" };
  const row = saintRow(s);
  const result = s.id
    ? await supabase.from("saints").update(row).eq("id", s.id).select("id, slug").maybeSingle()
    : await supabase.from("saints").insert(row).select("id, slug").single();
  if (result.error) return { status: prayerErrorCode(result.error.code) };
  // An update that matched no row means RLS hid it (e.g. an editor editing published content).
  if (!result.data) return { status: "forbidden" };

  revalidateSaint(result.data.slug);
  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(formData.get("locale"));
  if (!s.id) redirect(`/${locale}/admin/saints/${result.data.id}`);
  return { status: "saved" };
}

export async function deleteSaint(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const locale = z.enum(routing.locales).catch(routing.defaultLocale).parse(formData.get("locale"));
  const id = z.uuid().safeParse(formData.get("id"));
  if (!user || !isPublisher(user.roles) || !id.success) redirect(`/${locale}/admin/saints`);

  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.from("saints").delete().eq("id", id.data).select("slug").maybeSingle()) ?? {};
  if (data) revalidateSaint(data.slug);
  redirect(`/${locale}/admin/saints`);
}
