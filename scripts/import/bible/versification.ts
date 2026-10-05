/**
 * Maps a source's verse numbering onto the canonical (reference) versification.
 *
 * Canonical = the numbering used by the Tamil common-language Bible and most English Bibles:
 * Hebrew psalm numbers, psalm titles NOT counted as verses (they are headings / verse 0),
 * Joel 3 chapters, Malachi 4 chapters; the Greek additions to Esther and Daniel live in the
 * supplementary books ESG and DAG.
 *
 * Douay-Rheims (Challoner) follows the Latin Vulgate: Greek/Latin psalm numbers, psalm titles
 * counted as verse 1 (or 1-2), and the Daniel additions inline. Other Vulgate verse-boundary
 * differences (about 150 chapters, mostly one verse across a chapter break, and the Vulgate
 * text of Tobit, Judith and Sirach) are left as-is: the parallel view aligns those by verse
 * number and says that numbering can differ.
 */
import type { ParsedVerse } from "./types";

export type Scheme = "canonical" | "vulgate";

/** English psalms whose Vulgate/Hebrew numbering counts a title as verse 1. */
const ONE_VERSE_TITLE = new Set([
  3, 4, 5, 6, 7, 8, 9, 11, 12, 18, 19, 20, 21, 22, 30, 31, 34, 36, 38, 39, 40, 41, 42, 43, 45, 46, 47, 48, 49, 53, 55,
  57, 58, 59, 61, 62, 63, 64, 65, 67, 68, 69, 70, 75, 76, 77, 80, 81, 83, 84, 85, 88, 89, 92, 102, 108, 126, 136, 140,
  142,
]);
/** English psalms whose title spans two verses in the Vulgate/Hebrew numbering. */
const TWO_VERSE_TITLE = new Set([51, 52, 54, 60]);

export function psalmTitleVerses(englishPsalm: number): 0 | 1 | 2 {
  if (TWO_VERSE_TITLE.has(englishPsalm)) return 2;
  return ONE_VERSE_TITLE.has(englishPsalm) ? 1 : 0;
}

/** Vulgate psalm (chapter, verse) → English/Hebrew psalm (chapter, verse) before title handling. */
export function vulgatePsalmToHebrew(chapter: number, verse: number): { chapter: number; verse: number } {
  if (chapter <= 8 || chapter >= 148) return { chapter, verse };
  if (chapter === 9) return verse <= 21 ? { chapter: 9, verse } : { chapter: 10, verse: verse - 21 };
  if (chapter <= 112) return { chapter: chapter + 1, verse };
  if (chapter === 113) return verse <= 8 ? { chapter: 114, verse } : { chapter: 115, verse: verse - 8 };
  if (chapter === 114) return { chapter: 116, verse };
  if (chapter === 115) return { chapter: 116, verse: verse + 9 };
  if (chapter <= 145) return { chapter: chapter + 1, verse };
  if (chapter === 146) return { chapter: 147, verse };
  return { chapter: 147, verse: verse + 11 }; // 147
}

type Coordinates = { book: string; chapter: number; verse: number };

function vulgateToCanonical({ book, chapter, verse }: Coordinates): Coordinates {
  if (book === "PSA") {
    const hebrew = vulgatePsalmToHebrew(chapter, verse);
    // Only the first half of a split psalm starts with its title.
    const startsPsalm =
      !(chapter === 9 && verse > 21) && !(chapter === 113 && verse > 8) && chapter !== 115 && chapter !== 147;
    const titleVerses = startsPsalm ? psalmTitleVerses(hebrew.chapter) : 0;
    return { book, chapter: hebrew.chapter, verse: Math.max(0, hebrew.verse - titleVerses) };
  }
  if (book === "DAN") {
    if (chapter === 3 && verse >= 24 && verse <= 90) return { book: "DAG", chapter: 1, verse: verse - 23 };
    if (chapter === 3 && verse >= 91 && verse <= 97) return { book, chapter: 3, verse: verse - 67 };
    if (chapter === 3 && verse >= 98) return { book, chapter: 4, verse: verse - 97 };
    if (chapter === 4) return { book, chapter: 4, verse: verse + 3 };
    if (chapter === 13) return { book: "DAG", chapter: 2, verse };
    if (chapter === 14) return { book: "DAG", chapter: 3, verse };
  }
  return { book, chapter, verse };
}

export function toCanonical(scheme: Scheme, coordinates: Coordinates): Coordinates {
  return scheme === "vulgate" ? vulgateToCanonical(coordinates) : coordinates;
}

export function applyVersification(scheme: Scheme, verses: ParsedVerse[]): ParsedVerse[] {
  return verses.map((v) => ({
    ...v,
    canonical: toCanonical(scheme, { book: v.book, chapter: v.chapter, verse: v.verse }),
  }));
}
