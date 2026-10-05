import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { PageHeader } from "@/components/ui/page-header";
import { MediaUploadForm } from "@/components/admin/media-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMedia");
  return { title: t("uploadTitle"), robots: { index: false } };
}

export default async function NewMediaPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/media/new` });
  const t = await getTranslations("adminMedia");
  const options = await contentFormOptions(await adminDb(), user);
  return (
    <>
      <PageHeader title={t("uploadTitle")} description={t("description")} />
      <MediaUploadForm sources={options.sources} statuses={options.statuses} />
    </>
  );
}
