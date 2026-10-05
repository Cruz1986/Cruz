import { getTranslations } from "next-intl/server";
import { HandHeart } from "lucide-react";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { prayerTitle, publicPrayers } from "@/lib/content/prayers";
import { prayerPlainText } from "@/lib/prayers/markup";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PrayerLibrary, type LibraryCategory } from "@/components/prayers/prayer-library";

export const revalidate = 3600;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "prayers");
}

export default async function PrayersPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations();
  const [categories, prayers] = await Promise.all([publicPrayers.categories(), publicPrayers.list()]);

  const library: LibraryCategory[] = categories
    .map((c) => ({
      slug: c.slug,
      name: locale === "ta" ? c.nameTa : c.nameEn,
      prayers: prayers
        .filter((p) => p.categoryId === c.id)
        .map((p) => {
          const title = prayerTitle(p, locale);
          const other = prayerTitle(p, locale === "ta" ? "en" : "ta");
          const searchText = prayerPlainText([p.bodyTa, p.bodyEn].filter(Boolean).join("\n\n")).replace(/\s+/g, " ");
          return { slug: p.slug, title, altTitle: other !== title ? other : null, searchText };
        }),
    }))
    .filter((c) => c.prayers.length);

  return (
    <>
      <PageHeader title={t("pages.prayers.title")} description={t("pages.prayers.description")} />
      {library.length ? (
        <PrayerLibrary categories={library} />
      ) : (
        <EmptyState icon={HandHeart} title={t("prayers.unavailable")} body={t("prayers.unavailableBody")} />
      )}
    </>
  );
}
