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
import { MysteryForm } from "@/components/admin/rosary-form";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminRosary");
  return { title: t("edit"), robots: { index: false } };
}

export default async function EditMysteryPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/rosary/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await adminDb();
  const [options, { data }] = await Promise.all([
    contentFormOptions(db, user),
    db.from("rosary_mysteries").select("*, rosary_mystery_sets(name_en, name_ta)").eq("id", id).maybeSingle(),
  ]);
  if (!data) notFound();
  const m = z
    .object({
      id: z.string(),
      number: z.number(),
      title_en: z.string(),
      title_ta: z.string(),
      scripture_reference: z.string().nullable(),
      fruit_en: z.string().nullable(),
      fruit_ta: z.string().nullable(),
      meditation_en: z.string().nullable(),
      meditation_ta: z.string().nullable(),
      source_id: z.string(),
      status: z.enum(["draft", "in_review", "published", "archived"]),
      rosary_mystery_sets: z.object({ name_en: z.string(), name_ta: z.string() }),
    })
    .parse(data);
  const t = await getTranslations();
  const statuses = options.statuses.some((s) => s.value === m.status)
    ? options.statuses
    : [{ value: m.status, label: t(`status.${m.status}`) }, ...options.statuses];

  return (
    <>
      <PageHeader
        title={locale === "ta" ? m.title_ta : m.title_en}
        description={`${locale === "ta" ? m.rosary_mystery_sets.name_ta : m.rosary_mystery_sets.name_en} · ${t("adminRosary.number", { number: m.number })}`}
      />
      <MysteryForm
        id={m.id}
        initial={{
          titleEn: m.title_en,
          titleTa: m.title_ta,
          scripture: m.scripture_reference ?? "",
          fruitEn: m.fruit_en ?? "",
          fruitTa: m.fruit_ta ?? "",
          meditationEn: m.meditation_en ?? "",
          meditationTa: m.meditation_ta ?? "",
          sourceId: m.source_id,
          status: m.status,
        }}
        sources={options.sources}
        statuses={statuses}
      />
    </>
  );
}
