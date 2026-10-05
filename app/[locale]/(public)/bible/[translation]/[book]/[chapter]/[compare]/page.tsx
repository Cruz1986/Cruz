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

type Props = {
  params: Promise<{ locale: string; translation: string; book: string; chapter: string; compare: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, translation, book, chapter } = await params;
  // The single-translation page is the canonical one for search engines.
  return {
    ...(await chapterMetadata(await chapterFromSlugs(translation, book, chapter), locale)),
    robots: { index: false },
  };
}

export default async function ParallelPage({ params }: Props) {
  await initPage(params);
  const { translation, book, chapter: chapterSlug, compare } = await params;
  const [chapter, other] = await Promise.all([
    chapterFromSlugs(translation, book, chapterSlug),
    publicBible.translation(compare),
  ]);
  if (!chapter || !other || other.code === chapter.translation.code) notFound();

  const keys = chapter.verses.flatMap((v) => (v.key === null ? [] : [v.key]));
  const [translations, attribution, verses] = await Promise.all([
    publicBible.translations(),
    publicBible.attribution(chapter.translation.sourceId),
    publicBible.versesByKeys(other.code, keys),
  ]);
  return (
    <ChapterView
      chapter={chapter}
      translations={translations}
      paths={publicBiblePaths}
      attribution={attribution}
      compare={{ translation: other, verses }}
    />
  );
}
