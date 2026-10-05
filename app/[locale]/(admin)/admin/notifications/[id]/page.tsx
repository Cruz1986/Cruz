import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { announcementSchema, indiaLocal } from "@/lib/admin/announcements";
import { cancelAnnouncement } from "@/lib/admin/announcement-actions";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { AnnouncementForm } from "@/components/admin/announcement-form";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminAnnouncements");
  return { title: t("edit"), robots: { index: false } };
}

export default async function EditAnnouncementPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/notifications/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await (
    await adminDb()
  )
    .from("notifications")
    .select("id, title_en, title_ta, body_en, body_ta, url, scheduled_at, status, recipients")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = announcementSchema.parse(data);
  const t = await getTranslations("adminAnnouncements");
  const editable = a.status === "scheduled";

  return (
    <>
      <PageHeader title={locale === "ta" ? a.title_ta : a.title_en} description={t(`status.${a.status}`)}>
        {editable ? <DeleteButton id={a.id} action={cancelAnnouncement} label={t("cancel")} /> : null}
      </PageHeader>
      {editable ? (
        <AnnouncementForm
          id={a.id}
          initial={{
            titleEn: a.title_en,
            titleTa: a.title_ta,
            bodyEn: a.body_en ?? "",
            bodyTa: a.body_ta ?? "",
            url: a.url ?? "",
            scheduledAt: indiaLocal(a.scheduled_at),
          }}
        />
      ) : (
        <p className="bg-surface-muted rounded-xl p-3 text-sm">{t("locked")}</p>
      )}
    </>
  );
}
