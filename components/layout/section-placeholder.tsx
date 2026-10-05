import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NAV_ITEMS } from "./nav-items";

type SectionKey = "today" | "bible" | "prayers" | "rosary" | "saints" | "calendar";

/**
 * Shell for a module whose data layer arrives in a later phase. Shows the
 * real page header and an honest empty state instead of sample content.
 */
export async function SectionPlaceholder({ section }: { section: SectionKey }) {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`pages.${section}.title`)} description={t(`pages.${section}.description`)} />
      <EmptyState icon={NAV_ITEMS[section].icon} title={t("states.comingSoon")} body={t("states.comingSoonBody")} />
    </>
  );
}
