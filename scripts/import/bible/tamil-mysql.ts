/**
 * Parser for the Tamil-Bible-Database MySQL dump format (t_bookkey.sql + t_mybibleview.sql).
 * Rows are (verse_id BBCCCVVV, text, type) where type V = verse, T = heading. The text
 * uses private markers which are converted here to plain text + layout flags.
 */
import type { ParsedBook, ParsedHeading, ParsedTranslation, ParsedVerse } from "./types";

const MARK = {
  poemStart: /[⁽₍]/g,
  poemEnd: /[⁾₎]/g,
  lineBreak: /[␢§]/g,
  paragraph: "⒫",
  inlineTitle: "⒯",
  header: "⒣",
  verseLabel: /^❮([0-9]+[a-z]?(?:-[0-9]+[a-z]?)?)❯/,
  indent: /[⦃⦄⦅⦆]/g,
  footnoteMark: /\*/g,
} as const;

/** Undo MySQL string escaping inside a single-quoted literal. */
export function unescapeMysql(value: string): string {
  return value.replace(/\\(.)/g, (_, ch: string) => ({ n: "\n", r: "", t: "\t", "0": "" })[ch] ?? ch);
}

const ROW = /^\((\d{7,8}),\s*'((?:[^'\\]|\\.)*)',\s*'(\w*)'\)[,;]?\s*$/;
const BOOK_ROW =
  /^\((\d+),\s*'((?:[^'\\]|\\.)*)',\s*'(?:[^'\\]|\\.)*',\s*'(?:[^'\\]|\\.)*',\s*'(?:[^'\\]|\\.)*',\s*'(?:[^'\\]|\\.)*',\s*(?:'(?:[^'\\]|\\.)*'|NULL),\s*'((?:[^'\\]|\\.)*)'\)[,;]?\s*$/;

/** Book number → OSIS id, from t_bookkey (only real books; section rows have no OSIS id). */
export function parseBookKey(sql: string): Map<number, { osis: string; intro: string | null }> {
  const books = new Map<number, { osis: string; intro: string | null }>();
  for (const line of sql.split("\n")) {
    const m = BOOK_ROW.exec(line.trim());
    if (!m || !m[2]) continue;
    const intro = unescapeMysql(m[3]).trim();
    books.set(Number(m[1]), { osis: unescapeMysql(m[2]), intro: intro || null });
  }
  return books;
}

export function cleanVerseText(raw: string): Omit<ParsedVerse, "book" | "chapter" | "verse" | "part"> {
  let text = unescapeMysql(raw);
  let label: string | null = null;
  const labelMatch = MARK.verseLabel.exec(text);
  if (labelMatch) {
    label = labelMatch[1];
    text = text.slice(labelMatch[0].length);
  }
  const isPoetry = MARK.poemStart.test(text);
  MARK.poemStart.lastIndex = 0;
  const paragraphEnd = text.trimEnd().endsWith(MARK.paragraph);

  text = text
    .replace(MARK.poemStart, "")
    .replace(MARK.poemEnd, "")
    .replaceAll(MARK.inlineTitle, "\n")
    .replaceAll(MARK.paragraph, "\n")
    .replace(MARK.lineBreak, "\n")
    .replace(MARK.indent, "")
    .replace(MARK.footnoteMark, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  return { label, text, isPoetry, paragraphEnd };
}

/** Headings may hold a section title (⒣) before the heading, and § separated notes/cross-refs. */
export function parseHeading(raw: string): { level: 1 | 2; text: string }[] {
  const text = unescapeMysql(raw).replace(MARK.indent, "");
  const [section, heading] = text.includes(MARK.header) ? text.split(MARK.header, 2) : [null, text];
  const clean = (s: string) =>
    s
      .split("§")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  const out: { level: 1 | 2; text: string }[] = [];
  if (section && clean(section)) out.push({ level: 1, text: clean(section) });
  if (clean(heading)) out.push({ level: 2, text: clean(heading) });
  return out;
}

export function parseTamilMysql(
  bookKeySql: string,
  versesSql: string,
  osisToCode: ReadonlyMap<string, string>,
): ParsedTranslation {
  const bookKey = parseBookKey(bookKeySql);
  const bookCode = (bn: number) => {
    const entry = bookKey.get(bn);
    const code = entry && osisToCode.get(entry.osis);
    if (!code) throw new Error(`Unknown book number ${bn}`);
    return code;
  };

  const books: ParsedBook[] = [...bookKey.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bn, entry], index) => ({ book: bookCode(bn), order: index + 1, intro: entry.intro }));

  const verses: ParsedVerse[] = [];
  const headings: ParsedHeading[] = [];
  const headingCount = new Map<string, number>();

  for (const line of versesSql.split("\n")) {
    const m = ROW.exec(line.trim());
    if (!m) continue;
    const id = Number(m[1]);
    const bn = Math.floor(id / 1_000_000);
    const chapter = Math.floor(id / 1000) % 1000;
    const verse = id % 1000;
    const book = bookCode(bn);

    if (m[3] === "T") {
      for (const h of parseHeading(m[2])) {
        const key = `${book}.${chapter}.${verse}`;
        headingCount.set(key, (headingCount.get(key) ?? 0) + 1);
        headings.push({ book, chapter, beforeVerse: verse, level: h.level, text: h.text });
      }
      continue;
    }
    if (m[3] !== "V") continue;
    const cleaned = cleanVerseText(m[2]);
    if (!cleaned.text) continue;
    verses.push({ book, chapter, verse, part: "", ...cleaned });
  }

  return { books, verses, headings };
}
