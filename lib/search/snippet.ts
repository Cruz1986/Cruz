/** Search helpers shared by the search page and API (pure; unit tested). */
import { normalizeText } from "@/lib/bible/text";

/** The words of a query, as the database matches them (at least two characters, at most eight). */
export function queryWords(query: string): string[] {
  return [
    ...new Set(
      normalizeText(query)
        .split(" ")
        .filter((w) => w.length >= 2),
    ),
  ].slice(0, 8);
}

/**
 * A short excerpt of `text` around the first matching word, cut at word boundaries, with "…" where
 * text was left out. Falls back to the start of the text.
 */
export function snippet(text: string, words: string[], max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const lower = flat.normalize("NFC").toLowerCase();
  const hit =
    words
      .map((w) => lower.indexOf(w))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0] ?? 0;
  let start = Math.max(0, hit - Math.floor(max / 3));
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    start = space >= 0 && space < hit ? space + 1 : start;
  }
  let end = Math.min(flat.length, start + max);
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    end = space > start ? space : end;
  }
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/** Canonical verse keys (see bible_verses.canonical_vkey) covering a reference. */
export function referenceKeys(
  canonOrder: number,
  ref: { chapter: number; verse: number | null; verseEnd: number | null },
): [number, number] {
  const base = canonOrder * 1_000_000 + ref.chapter * 1000;
  return [base + (ref.verse ?? 1), base + (ref.verseEnd ?? ref.verse ?? 999)];
}
