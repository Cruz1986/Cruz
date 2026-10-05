import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { SourceForm } from "@/components/admin/source-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminSources");
  return { title: t("new"), robots: { index: false } };
}

export default async function NewSourcePage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/sources/new` });
  const t = await getTranslations("adminSources");
  return (
    <>
      <PageHeader title={t("new")} />
      <SourceForm
        initial={{
          name: "",
          copyrightHolder: "",
          licenseType: "unknown",
          permissionStatus: "pending",
          attribution: "",
          approval: "",
          licenseUrl: "",
          notes: "",
        }}
      />
    </>
  );
}
