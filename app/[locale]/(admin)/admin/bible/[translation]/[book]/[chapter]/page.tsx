import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { getAttribution, getChapter, listTranslations } from "@/lib/content/bible";
import { bookFromSlug, chapterFromSlug } from "@/lib/bible/paths";
import { ChapterView, type ChapterPaths } from "@/components/bible/chapter-view";

type Props = { params: Promise<{ locale: string; translation: string; book: string; chapter: string }> };

const previewPaths: ChapterPaths = {
  chapter: (translation, book, chapter) => `/admin/bible/${translation}/${book.toLowerCase()}/${chapter}`,
  book: (translation, book) => `/admin/bible/${translation}/${book.toLowerCase()}/1`,
  parallel: (translation, book, chapter) => `/admin/bible/${translation}/${book.toLowerCase()}/${chapter}`,
};

export const metadata: Metadata = { robots: { index: false } };

/** Staff preview of any translation, including unpublished ones (RLS: staff read all). */
export default async function AdminBiblePreviewPage({ params }: Props) {
  const locale = await initPage(params);
  const { translation, book: bookSlug, chapter: chapterSlug } = await params;
  await requireRoles(STAFF_ROLES, {
    locale,
    nextPath: `/${locale}/admin/bible/${translation}/${bookSlug}/${chapterSlug}`,
  });

  const db = await createSupabaseServerClient();
  const book = bookFromSlug(bookSlug);
  const chapterNumber = chapterFromSlug(chapterSlug);
  if (!db || !book || chapterNumber === null) notFound();

  const chapter = await getChapter(db, translation, book, chapterNumber);
  if (!chapter) notFound();
  const [translations, attribution] = await Promise.all([
    listTranslations(db),
    getAttribution(db, chapter.translation.sourceId),
  ]);
  const t = await getTranslations();

  return (
    <div className="space-y-4">
      {chapter.translation.status !== "published" ? (
        <p role="note" className="border-lit-red/40 text-lit-red rounded-xl border p-3 text-sm">
          {t("bible.staffPreview", { status: t(`status.${chapter.translation.status}`) })}
        </p>
      ) : null}
      <ChapterView
        chapter={chapter}
        translations={translations}
        paths={previewPaths}
        attribution={attribution}
        remember={false}
      />
    </div>
  );
}
