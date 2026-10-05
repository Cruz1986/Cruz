import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { initPage } from "@/lib/i18n/page";
import { chapterFromSlugs, publicBible } from "@/lib/content/public-bible";
import { publicBiblePaths } from "@/lib/bible/paths";
import { ChapterView } from "@/components/bible/chapter-view";
import { chapterMetadata } from "@/components/bible/chapter-metadata";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; translation: string; book: string; chapter: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, translation, book, chapter } = await params;
  return chapterMetadata(await chapterFromSlugs(translation, book, chapter), locale);
}

export default async function ChapterPage({ params }: Props) {
  await initPage(params);
  const { translation, book, chapter: chapterSlug } = await params;
  const chapter = await chapterFromSlugs(translation, book, chapterSlug);
  if (!chapter) notFound();
  const [translations, attribution] = await Promise.all([
    publicBible.translations(),
    publicBible.attribution(chapter.translation.sourceId),
  ]);
  return (
    <ChapterView chapter={chapter} translations={translations} paths={publicBiblePaths} attribution={attribution} />
  );
}
