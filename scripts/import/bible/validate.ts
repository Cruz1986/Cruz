import type { ParsedTranslation } from "./types";

export type Issue = { level: "error" | "warning"; message: string };

/**
 * Structural checks before anything is written (PRD §24): known books, numbering,
 * duplicates, empty text, chapter continuity. Verse gaps are warnings because some
 * translations intentionally omit or merge verses.
 */
export function validateTranslation(
  parsed: ParsedTranslation,
  knownBooks: ReadonlySet<string>,
  maxIssues = 200,
): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], message: string) => {
    if (issues.length < maxIssues) issues.push({ level, message });
  };

  for (const book of parsed.books) if (!knownBooks.has(book.book)) add("error", `Unknown book code ${book.book}`);
  const listed = new Set(parsed.books.map((b) => b.book));

  const seen = new Set<string>();
  const chapters = new Map<string, Map<number, number[]>>();
  for (const v of parsed.verses) {
    const ref = `${v.book} ${v.chapter}:${v.verse}${v.part}`;
    if (!listed.has(v.book)) add("error", `${ref}: book not in book list`);
    if (!Number.isInteger(v.chapter) || v.chapter < 0 || v.chapter > 999) add("error", `${ref}: invalid chapter`);
    if (!Number.isInteger(v.verse) || v.verse < 0 || v.verse > 999) add("error", `${ref}: invalid verse`);
    if (!v.text.trim()) add("error", `${ref}: empty text`);
    if (seen.has(ref)) add("error", `${ref}: duplicate verse`);
    seen.add(ref);
    const byChapter = chapters.get(v.book) ?? new Map<number, number[]>();
    byChapter.set(v.chapter, [...(byChapter.get(v.chapter) ?? []), v.verse]);
    chapters.set(v.book, byChapter);
  }

  for (const [book, byChapter] of chapters) {
    // Chapter 0 is an optional prologue; real chapters must run 1..n without gaps.
    const numbers = [...byChapter.keys()].filter((n) => n > 0).sort((a, b) => a - b);
    numbers.forEach((n, i) => {
      if (n !== i + 1) add("error", `${book}: chapters are not continuous (found ${n} at position ${i + 1})`);
    });
    for (const [chapter, verses] of byChapter) {
      const sorted = [...new Set(verses)].sort((a, b) => a - b);
      const start = sorted[0] === 0 ? 0 : 1;
      const missing: number[] = [];
      for (let n = Math.max(start, 1), j = 0; n <= sorted.at(-1)!; n++) {
        while (sorted[j] < n) j++;
        if (sorted[j] !== n) missing.push(n);
      }
      if (missing.length) add("warning", `${book} ${chapter}: no verse ${missing.join(", ")}`);
    }
  }

  for (const h of parsed.headings) {
    if (!listed.has(h.book)) add("error", `Heading in unknown book ${h.book}`);
    if (!h.text.trim()) add("error", `${h.book} ${h.chapter}: empty heading`);
  }

  if (parsed.verses.length === 0) add("error", "No verses found");
  return issues;
}
