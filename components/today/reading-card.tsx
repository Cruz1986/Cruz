import { getLocale, getTranslations } from "next-intl/server";
import { BookOpen } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { ReadingSlot, LectionaryReading } from "@/lib/liturgy/readings";
import { displayableReference, formatRanges, vkeyRanges } from "@/lib/liturgy/readings";
import type { PassageVerse } from "@/lib/content/today";
import type { Translation } from "@/lib/content/bible";
import { biblePath } from "@/lib/bible/paths";

type Books = Map<string, { abbrEn: string; abbrTa: string }>;

function Passage({ verses, language }: { verses: PassageVerse[]; language: string }) {
  return (
    <div lang={language} className="reading mt-3 max-w-none">
      {verses.map((v, i) => (
        <span key={`${v.key}-${i}`} className={v.isPoetry ? "block" : undefined}>
          <sup className="text-accent mr-1 align-super font-sans text-[0.7em] font-semibold">{v.label}</sup>
          {v.isPoetry
            ? v.text.split("\n").map((line, j) => (
                <span key={j} className="block pl-6 -indent-6">
                  {line}
                </span>
              ))
            : `${v.text} `}
        </span>
      ))}
    </div>
  );
}

export async function ReadingCard({
  slot,
  passages,
  translation,
  canonOrder,
  books,
  showText = true,
}: {
  slot: ReadingSlot;
  passages: Map<string, PassageVerse[]>;
  translation: Translation | null;
  canonOrder: Map<string, number>;
  books: Books;
  showText?: boolean;
}) {
  const t = await getTranslations("today");
  const locale = await getLocale();
  const label =
    slot.type === "first" && slot.sequence > 1
      ? t("reading.firstNumbered", { n: slot.sequence })
      : t(`reading.${slot.type}`);

  const reference = (option: LectionaryReading) => {
    if (!option.ranges.length) return displayableReference(option);
    return locale === "ta" ? option.reference : formatRanges(option.ranges, (code) => books.get(code)?.abbrEn ?? code);
  };

  return (
    <section className="border-border bg-surface rounded-2xl border p-5">
      <h3 className="text-gold text-sm font-semibold">{label}</h3>
      {slot.options.map((option, i) => {
        const verses = vkeyRanges(option.ranges, canonOrder).flatMap(([a, b]) => passages.get(`${a}-${b}`) ?? []);
        const first = option.ranges[0];
        const ref = reference(option);
        return (
          <div
            key={`${option.sourceType}-${i}`}
            className={i > 0 ? "border-border mt-4 border-t border-dashed pt-4" : "mt-1"}
          >
            {i > 0 ? <p className="text-fg-muted mb-1 text-sm font-medium">{t("or")}</p> : null}
            <p className="text-fg flex flex-wrap items-baseline gap-x-2 font-semibold">
              {ref ? <span lang={locale === "ta" && option.ranges.length ? "ta" : undefined}>{ref}</span> : null}
              {option.isShort ? <span className="text-fg-muted text-sm font-normal">({t("shorter")})</span> : null}
            </p>
            {showText && option.ranges.length ? (
              verses.length && translation ? (
                <Passage verses={verses} language={translation.language} />
              ) : (
                <p className="text-fg-muted mt-2 text-sm">{t("noText")}</p>
              )
            ) : null}
            {translation && first ? (
              <Link
                href={biblePath(translation.code, first.book, first.startChapter, first.startVerse)}
                className="text-accent mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <BookOpen aria-hidden className="size-4" />
                {t("readInBible")}
              </Link>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
