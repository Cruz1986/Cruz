import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { PageHeader } from "@/components/ui/page-header";
import { TranslationForm } from "@/components/admin/bible-forms";

type Props = { params: Promise<{ locale: string; translation: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminBible");
  return { title: t("edit"), robots: { index: false } };
}

export default async function TranslationSettingsPage({ params }: Props) {
  const locale = await initPage(params);
  const { translation } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/bible/${translation}/settings` });
  if (!/^[a-z]{2}-[a-z0-9-]+$/.test(translation)) notFound();
  const db = await adminDb();
  const [options, { data }] = await Promise.all([
    contentFormOptions(db, user),
    db.from("bible_translations").select("*").eq("code", translation).maybeSingle(),
  ]);
  if (!data) notFound();
  const tr = z
    .object({
      id: z.string(),
      name: z.string(),
      short_name: z.string(),
      description: z.string().nullable(),
      sort_order: z.number(),
      source_id: z.string(),
      status: z.enum(["draft", "in_review", "published", "archived"]),
    })
    .parse(data);
  const t = await getTranslations();
  const statuses = options.statuses.some((s) => s.value === tr.status)
    ? options.statuses
    : [{ value: tr.status, label: t(`status.${tr.status}`) }, ...options.statuses];

  return (
    <>
      <PageHeader title={tr.name} description={t("adminBible.edit")} />
      <TranslationForm
        id={tr.id}
        initial={{
          name: tr.name,
          shortName: tr.short_name,
          description: tr.description ?? "",
          sortOrder: String(tr.sort_order),
          sourceId: tr.source_id,
          status: tr.status,
        }}
        sources={options.sources}
        statuses={statuses}
      />
    </>
  );
}
