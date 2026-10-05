import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "credits");
}

/** Will list rows from `content_sources` once the database exists (Phase 2). */
export default async function CreditsPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("pages.credits");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <EmptyState icon={Info} title={t("empty")} />
    </>
  );
}
