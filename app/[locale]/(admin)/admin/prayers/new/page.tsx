import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { prayerFormOptions } from "@/lib/admin/prayer-admin-data";
import { PageHeader } from "@/components/ui/page-header";
import { PrayerForm } from "@/components/admin/prayer-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPrayers");
  return { title: t("newPrayer"), robots: { index: false } };
}

export default async function NewPrayerPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/prayers/new` });
  const t = await getTranslations("adminPrayers");
  const options = await prayerFormOptions(user, locale);
  return (
    <>
      <PageHeader title={t("newPrayer")} />
      <PrayerForm
        initial={{
          slug: "",
          categoryId: options.categories[0]?.value ?? "",
          sourceId: options.sources[0]?.value ?? "",
          sortOrder: 0,
          status: "draft",
          titleEn: "",
          bodyEn: "",
          titleTa: "",
          bodyTa: "",
        }}
        categories={options.categories}
        sources={options.sources}
        statuses={options.statuses}
      />
    </>
  );
}
