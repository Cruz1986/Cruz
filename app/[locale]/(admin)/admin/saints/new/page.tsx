import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { monthNames } from "@/lib/saints/helpers";
import { PageHeader } from "@/components/ui/page-header";
import { SaintForm } from "@/components/admin/saint-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminSaints");
  return { title: t("newSaint"), robots: { index: false } };
}

export default async function NewSaintPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/saints/new` });
  const db = await createSupabaseServerClient();
  if (!db) notFound();
  const t = await getTranslations("adminSaints");
  const options = await contentFormOptions(db, user);
  return (
    <>
      <PageHeader title={t("newSaint")} />
      <SaintForm
        initial={{
          slug: "",
          sourceId: options.sources[0]?.value ?? "",
          status: "draft",
          nameEn: "",
          nameTa: "",
          titleEn: "",
          titleTa: "",
          feastMonth: "",
          feastDay: "",
          birthYear: "",
          deathYear: "",
          patronageEn: "",
          patronageTa: "",
          biographyEn: "",
          biographyTa: "",
        }}
        sources={options.sources}
        statuses={options.statuses}
        monthNames={monthNames(locale)}
      />
    </>
  );
}
