import { getTranslations } from "next-intl/server";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { allBooks, publicBible } from "@/lib/content/public-bible";
import { publicPrayers } from "@/lib/content/prayers";
import { publicSaints } from "@/lib/content/saints";
import { PageHeader } from "@/components/ui/page-header";
import { Library, type LibraryLookups } from "@/components/personal/library";

export const revalidate = 3600;

export async function generateMetadata({ params }: LocaleParams) {
  return { ...(await pageMetadata(params, "library")), robots: { index: false } };
}

export default async function LibraryPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("pages.library");
  const [books, translations, prayers, saints] = await Promise.all([
    allBooks(),
    publicBible.translations(),
    publicPrayers.list(),
    publicSaints.list(),
  ]);
  // Names only: the library itself lives in the reader's browser (and account).
  const lookups: LibraryLookups = {
    books: Object.fromEntries([...books].map(([code, b]) => [code, { en: b.nameEn, ta: b.nameTa }])),
    translations: Object.fromEntries(translations.map((tr) => [tr.code, tr.shortName])),
    prayers: Object.fromEntries(
      prayers.map((p) => [p.slug, { en: p.titleEn ?? p.titleTa ?? p.slug, ta: p.titleTa ?? p.titleEn ?? p.slug }]),
    ),
    saints: Object.fromEntries(saints.map((s) => [s.slug, { en: s.nameEn, ta: s.nameTa }])),
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Library lookups={lookups} />
    </>
  );
}
