import { normalizeText } from "./text";

export type BibleReference = { book: string; chapter: number; verse: number | null; verseEnd: number | null };

/** Builds a lookup from every book alias (any language) to its book code. */
export function buildAliasIndex(aliases: Iterable<{ alias: string; code: string }>): Map<string, string> {
  const index = new Map<string, string>();
  for (const { alias, code } of aliases) {
    const key = normalizeText(alias).replace(/\.$/, "");
    if (key) index.set(key, code);
  }
  return index;
}

const NUMBERS = /^(\d{1,3})(?:\s*[:.,]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/;

/**
 * Parses "John 3:16", "jn 3.16-18", "1 Sam 3", "யோவா 3:16", "திருப்பாடல்கள் 23".
 * The longest matching book alias wins. Returns null when the input is not a reference.
 */
export function parseReference(input: string, aliases: ReadonlyMap<string, string>): BibleReference | null {
  const text = normalizeText(input);
  const match = /^(.*?)\s*(\d{1,3}(?:\s*[:.,]\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?)?)$/.exec(text);
  if (!match) return null;

  const bookPart = match[1].replace(/\.$/, "").trim();
  if (!bookPart) return null;
  const code = aliases.get(bookPart) ?? aliases.get(bookPart.replace(/\s+/g, ""));
  if (!code) return null;

  const numbers = NUMBERS.exec(match[2]);
  if (!numbers) return null;
  const chapter = Number(numbers[1]);
  const verse = numbers[2] ? Number(numbers[2]) : null;
  const verseEnd = numbers[3] ? Number(numbers[3]) : null;
  if (chapter < 1 || (verse !== null && verse < 0) || (verseEnd !== null && verse !== null && verseEnd < verse)) {
    return null;
  }
  return { book: code, chapter, verse, verseEnd };
}
