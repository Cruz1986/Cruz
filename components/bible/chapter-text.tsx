import type { ReactNode } from "react";
import type { Heading, Verse } from "@/lib/content/bible";
import { cn } from "@/lib/cn";

/**
 * Renders a chapter as readable text: section headings, prose paragraphs and poetry lines.
 * Translations without paragraph data (e.g. Douay-Rheims) are shown one verse per line.
 * Each verse carries data attributes used by the client-side verse selection.
 */
export function ChapterText({
  verses,
  headings,
  language,
}: {
  verses: Verse[];
  headings: Heading[];
  language: string;
}) {
  const versePerLine = !verses.some((v) => v.paragraphEnd || v.isPoetry);
  const headingsBefore = new Map<number, Heading[]>();
  for (const h of headings) headingsBefore.set(h.beforeVerse, [...(headingsBefore.get(h.beforeVerse) ?? []), h]);

  const blocks: ReactNode[] = [];
  let paragraph: ReactNode[] = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push(
        <p key={`p${blocks.length}`} className="mb-4">
          {paragraph}
        </p>,
      );
    paragraph = [];
  };

  const emitHeadings = (verse: number) => {
    for (const [i, h] of (headingsBefore.get(verse) ?? []).entries()) {
      flush();
      const [title, ...notes] = h.text.split("\n");
      blocks.push(
        <div key={`h${verse}-${i}`} className={cn("mt-6 mb-3 font-sans", h.level === 1 && "mt-8")}>
          <h2 className={cn("text-fg font-semibold", h.level === 1 ? "text-gold text-lg" : "text-base")}>{title}</h2>
          {notes.map((note) => (
            <p key={note} className="text-fg-muted text-sm">
              {note}
            </p>
          ))}
        </div>,
      );
    }
  };

  const seenHeadings = new Set<number>();
  for (const verse of verses) {
    if (!seenHeadings.has(verse.verse)) {
      emitHeadings(verse.verse);
      seenHeadings.add(verse.verse);
    }
    const number = (
      <sup className="text-accent mr-1 align-super font-sans text-[0.7em] font-semibold select-none">{verse.label}</sup>
    );
    const attrs = {
      id: `v${verse.verse}`,
      "data-verse": verse.verse,
      "data-label": verse.label,
      "data-text": verse.text,
      "data-key": verse.key ?? undefined,
    };

    if (verse.isPoetry) {
      flush();
      const lines = verse.text.split("\n");
      blocks.push(
        <div key={verse.id} {...attrs} className="verse mb-2 scroll-mt-24 rounded-md">
          {lines.map((line, i) => (
            <span key={i} className="block pl-6 -indent-6">
              {i === 0 ? number : null}
              {line}
            </span>
          ))}
        </div>,
      );
      if (verse.paragraphEnd) blocks.push(<div key={`gap${verse.id}`} className="h-3" />);
    } else if (versePerLine) {
      blocks.push(
        <p key={verse.id} {...attrs} className="verse mb-2 scroll-mt-24 rounded-md">
          {number}
          {verse.text}
        </p>,
      );
    } else {
      paragraph.push(
        <span key={verse.id} {...attrs} className="verse scroll-mt-24 rounded-md">
          {number}
          {verse.text}{" "}
        </span>,
      );
      if (verse.paragraphEnd) flush();
    }
  }
  flush();

  return (
    <div lang={language} className="reading max-w-[70ch]">
      {blocks}
    </div>
  );
}
