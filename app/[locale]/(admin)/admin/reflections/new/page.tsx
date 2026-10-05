import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { parseIsoDate, todayIn, toIso } from "@/lib/liturgy/plain-date";
import { PageHeader } from "@/components/ui/page-header";
import { ReflectionForm } from "@/components/admin/reflection-form";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminReflections");
  return { title: t("new"), robots: { index: false } };
}

export default async function NewReflectionPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/reflections/new` });
  const { date } = await searchParams;
  const t = await getTranslations("adminReflections");
  const options = await contentFormOptions(await adminDb(), user);
  return (
    <>
      <PageHeader title={t("new")} />
      <ReflectionForm
        initial={{
          date: date && parseIsoDate(date) ? date : toIso(todayIn(DEFAULT_TIME_ZONE)),
          language: locale,
          title: "",
          body: "",
          author: "",
          sourceId: options.sources[0]?.value ?? "",
          status: "draft",
        }}
        sources={options.sources}
        statuses={options.statuses}
      />
    </>
  );
}
