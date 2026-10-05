import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { publicBible } from "@/lib/content/public-bible";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { BookList } from "@/components/bible/book-list";
import { TranslationPicker } from "@/components/bible/translation-picker";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; translation: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const translation = await publicBible.translation((await params).translation);
  return translation ? { title: translation.name } : {};
}

export default async function TranslationPage({ params }: Props) {
  await initPage(params);
  const { translation: code } = await params;
  const [translation, translations] = await Promise.all([publicBible.translation(code), publicBible.translations()]);
  if (!translation) notFound();
  const books = await publicBible.books(code);
  const t = await getTranslations("bible");

  return (
    <>
      <PageHeader title={translation.name}>
        <Link href={`/bible/search?t=${code}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <Search aria-hidden className="size-4" />
          {t("search")}
        </Link>
      </PageHeader>
      <div className="space-y-6">
        <TranslationPicker translations={translations} current={code} hrefFor={(c) => `/bible/${c}`} />
        <BookList translation={code} books={books} />
      </div>
    </>
  );
}
