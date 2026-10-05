"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { usePersonalStore } from "@/lib/personal/client";
import { chapterKey, parseLocation } from "@/lib/personal/store";
import { RecordVisit } from "@/components/personal/item-actions";

/** Adds the chapter to the reader's history (which also powers "Continue reading"). */
export function RememberPosition({
  translation,
  book,
  chapter,
  title,
}: {
  translation: string;
  book: string;
  chapter: number;
  title: string;
}) {
  return <RecordVisit type="chapter" entityKey={chapterKey(translation, book, chapter)} title={title} />;
}

export function ContinueReading() {
  const t = useTranslations("bible");
  const store = usePersonalStore();
  const last = store.history.find((h) => h.type === "chapter");
  const position = last ? parseLocation(last.key) : null;
  if (!last || !position) return null;

  return (
    <Link
      href={`/bible/${position.translation}/${position.book.toLowerCase()}/${position.chapter}`}
      className="border-accent/30 bg-accent-soft text-fg hover:border-accent flex items-center gap-3 rounded-2xl border p-4"
    >
      <BookOpen aria-hidden className="text-accent size-5" />
      <span className="flex-1">
        <span className="text-fg-muted block text-sm">{t("continueReading")}</span>
        <span className="font-semibold">{last.title}</span>
      </span>
      <ArrowRight aria-hidden className="text-accent size-4" />
    </Link>
  );
}
