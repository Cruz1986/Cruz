import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { defaultSendTime } from "@/lib/admin/announcements";
import { PageHeader } from "@/components/ui/page-header";
import { AnnouncementForm } from "@/components/admin/announcement-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminAnnouncements");
  return { title: t("new"), robots: { index: false } };
}

export default async function NewAnnouncementPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/notifications/new` });
  const t = await getTranslations("adminAnnouncements");
  return (
    <>
      <PageHeader title={t("new")} description={t("description")} />
      <AnnouncementForm
        initial={{ titleEn: "", titleTa: "", bodyEn: "", bodyTa: "", url: "", scheduledAt: defaultSendTime() }}
      />
    </>
  );
}
