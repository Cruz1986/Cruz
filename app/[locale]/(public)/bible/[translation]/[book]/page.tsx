import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { publicBible } from "@/lib/content/public-bible";
import { biblePath, bookFromSlug } from "@/lib/bible/paths";
import { PageHeader } from "@/components/ui/page-header";
import { bookName } from "@/components/bible/book-name";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; translation: string; book: string }> };

async function load(params: Props["params"]) {
  const { locale, translation, book: slug } = await params;
  const code = bookFromSlug(slug);
  const books = code ? await publicBible.books(translation) : [];
  const book = books.find((b) => b.code === code);
  return { locale, translation, book };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, book } = await load(params);
  return book ? { title: bookName(book, locale) } : {};
}

export default async function BookPage({ params }: Props) {
  await initPage(params);
  const { locale, translation, book } = await load(params);
  if (!book) notFound();
  const t = await getTranslations("bible");

  return (
    <>
      <PageHeader title={bookName(book, locale)} description={t("chapters")} />
      <ul className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
        {book.chapters.map((chapter) => (
          <li key={chapter}>
            <Link
              href={biblePath(translation, book.code, chapter)}
              aria-label={chapter === 0 ? t("prologue") : t("chapter", { chapter })}
              className="border-border bg-surface text-fg hover:border-accent hover:text-accent flex aspect-square items-center justify-center rounded-xl border font-semibold tabular-nums"
            >
              {chapter === 0 ? "★" : chapter}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
