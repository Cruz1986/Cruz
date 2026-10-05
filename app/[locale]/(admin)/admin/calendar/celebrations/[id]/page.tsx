import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { listSaints } from "@/lib/content/saints";
import { PageHeader } from "@/components/ui/page-header";
import { CelebrationForm } from "@/components/admin/calendar-forms";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminCalendar");
  return { title: t("editCelebration"), robots: { index: false } };
}

export default async function EditCelebrationPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/calendar/celebrations/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await adminDb();
  const [{ data }, saints] = await Promise.all([
    db.from("celebrations").select("id, name_en, name_ta, color, saint_id").eq("id", id).maybeSingle(),
    listSaints(db),
  ]);
  if (!data) notFound();
  const c = z
    .object({
      id: z.string(),
      name_en: z.string(),
      name_ta: z.string(),
      color: z.string(),
      saint_id: z.string().nullable(),
    })
    .parse(data);
  const t = await getTranslations("adminCalendar");

  return (
    <>
      <PageHeader title={locale === "ta" ? c.name_ta : c.name_en} description={t("locked")} />
      <CelebrationForm
        id={c.id}
        initial={{ nameEn: c.name_en, nameTa: c.name_ta, color: c.color, saintId: c.saint_id ?? "" }}
        saints={saints.map((s) => ({ value: s.id, label: locale === "ta" ? s.nameTa : s.nameEn }))}
      />
    </>
  );
}
