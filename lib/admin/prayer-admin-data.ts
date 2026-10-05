import "server-only";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/server";
import { listCategories } from "@/lib/content/prayers";
import type { SessionUser } from "@/lib/auth/session";
import type { DbClient } from "@/lib/db/public";
import { allowedStatuses } from "./prayer-form";

/** Options for the prayer form, loaded with the staff member's own session. */
export async function prayerFormOptions(user: SessionUser, locale: string) {
  const db = await createSupabaseServerClient();
  if (!db) notFound();
  const [categories, common] = await Promise.all([listCategories(db), contentFormOptions(db, user)]);
  return {
    db,
    categories: categories.map((c) => ({ value: c.id, label: locale === "ta" ? c.nameTa : c.nameEn })),
    ...common,
  };
}

/** Content sources (unverified ones marked) and the statuses the user may set. */
export async function contentFormOptions(db: DbClient, user: SessionUser) {
  const t = await getTranslations();
  const sources = await db.from("content_sources").select("id, name, permission_status, license_type").order("name");
  if (sources.error) throw new Error(sources.error.message);
  const sourceRows = z
    .array(z.object({ id: z.string(), name: z.string(), permission_status: z.string(), license_type: z.string() }))
    .parse(sources.data);
  return {
    sources: sourceRows.map((s) => ({
      value: s.id,
      label:
        s.permission_status === "verified" && s.license_type !== "unknown"
          ? s.name
          : `${s.name} (${t("adminPrayers.form.sourceNotVerified")})`,
    })),
    statuses: allowedStatuses(user.roles).map((s) => ({ value: s, label: t(`status.${s}`) })),
  };
}
