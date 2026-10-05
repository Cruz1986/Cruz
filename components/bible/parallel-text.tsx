import { getTranslations } from "next-intl/server";
import type { Chapter, Translation, Verse } from "@/lib/content/bible";

function Lines({ verse }: { verse: Verse }) {
  const number = <sup className="text-accent mr-1 align-super font-sans text-[0.7em] font-semibold">{verse.label}</sup>;
  if (!verse.isPoetry) {
    return (
      <p>
        {number}
        {verse.text.replace(/\n/g, " ")}
      </p>
    );
  }
  return (
    <>
      {verse.text.split("\n").map((line, i) => (
        <span key={i} className="block pl-6 -indent-6">
          {i === 0 ? number : null}
          {line}
        </span>
      ))}
    </>
  );
}

/** Side-by-side reading aligned by canonical verse key (stacked on small screens). */
export async function ParallelText({
  chapter,
  other,
  otherVerses,
}: {
  chapter: Chapter;
  other: Translation;
  otherVerses: Map<number, Verse[]>;
}) {
  const t = await getTranslations("bible");
  const main = chapter.translation;
  const unmatched = chapter.verses.some((v) => v.key === null || !otherVerses.has(v.key));

  return (
    <div className="space-y-4">
      {unmatched ? <p className="bg-surface-muted text-fg-muted rounded-xl p-3 text-sm">{t("numberingNote")}</p> : null}
      <div className="border-border text-fg-muted hidden grid-cols-2 gap-6 border-b pb-2 text-sm font-semibold md:grid">
        <p lang={main.language}>{main.shortName}</p>
        <p lang={other.language}>{other.shortName}</p>
      </div>
      <ol className="space-y-4">
        {chapter.verses.map((verse) => {
          const matches = verse.key !== null ? (otherVerses.get(verse.key) ?? []) : [];
          return (
            <li key={verse.id} id={`v${verse.verse}`} className="grid scroll-mt-24 gap-2 md:grid-cols-2 md:gap-6">
              <div lang={main.language} className="reading">
                <span className="sr-only md:hidden">{main.shortName}: </span>
                <Lines verse={verse} />
              </div>
              <div lang={other.language} className="reading border-border text-fg border-l-2 pl-3 md:border-0 md:pl-0">
                <span className="sr-only">{other.shortName}: </span>
                {matches.length ? (
                  matches.map((m) => (
                    <div key={m.id}>
                      <Lines verse={m} />
                    </div>
                  ))
                ) : (
                  <span className="text-fg-muted text-sm italic">{t("noMatch")}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
