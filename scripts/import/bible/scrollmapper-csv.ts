/**
 * Parser for scrollmapper/bible_databases CSV exports (Book,Chapter,Verse,Text).
 * Books outside the Catholic canon (e.g. Prayer of Manasses, 1-2 Esdras, Laodiceans) are skipped.
 */
import type { ParsedBook, ParsedTranslation, ParsedVerse } from "./types";

export const SCROLLMAPPER_BOOKS: Readonly<Record<string, string>> = {
  Genesis: "GEN",
  Exodus: "EXO",
  Leviticus: "LEV",
  Numbers: "NUM",
  Deuteronomy: "DEU",
  Joshua: "JOS",
  Judges: "JDG",
  Ruth: "RUT",
  "I Samuel": "1SA",
  "II Samuel": "2SA",
  "I Kings": "1KI",
  "II Kings": "2KI",
  "I Chronicles": "1CH",
  "II Chronicles": "2CH",
  Ezra: "EZR",
  Nehemiah: "NEH",
  Tobit: "TOB",
  Judith: "JDT",
  Esther: "EST",
  "I Maccabees": "1MA",
  "II Maccabees": "2MA",
  Job: "JOB",
  Psalms: "PSA",
  Proverbs: "PRO",
  Ecclesiastes: "ECC",
  "Song of Solomon": "SNG",
  Wisdom: "WIS",
  Sirach: "SIR",
  Isaiah: "ISA",
  Jeremiah: "JER",
  Lamentations: "LAM",
  Baruch: "BAR",
  Ezekiel: "EZK",
  Daniel: "DAN",
  Hosea: "HOS",
  Joel: "JOL",
  Amos: "AMO",
  Obadiah: "OBA",
  Jonah: "JON",
  Micah: "MIC",
  Nahum: "NAM",
  Habakkuk: "HAB",
  Zephaniah: "ZEP",
  Haggai: "HAG",
  Zechariah: "ZEC",
  Malachi: "MAL",
  Matthew: "MAT",
  Mark: "MRK",
  Luke: "LUK",
  John: "JHN",
  Acts: "ACT",
  Romans: "ROM",
  "I Corinthians": "1CO",
  "II Corinthians": "2CO",
  Galatians: "GAL",
  Ephesians: "EPH",
  Philippians: "PHP",
  Colossians: "COL",
  "I Thessalonians": "1TH",
  "II Thessalonians": "2TH",
  "I Timothy": "1TI",
  "II Timothy": "2TI",
  Titus: "TIT",
  Philemon: "PHM",
  Hebrews: "HEB",
  James: "JAS",
  "I Peter": "1PE",
  "II Peter": "2PE",
  "I John": "1JN",
  "II John": "2JN",
  "III John": "3JN",
  Jude: "JUD",
  "Revelation of John": "REV",
};

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, newlines in quotes). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

export function parseScrollmapperCsv(csv: string): ParsedTranslation & { skippedBooks: string[] } {
  const [header, ...rows] = parseCsv(csv);
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`Missing CSV column ${name}`);
    return index;
  };
  const [bookCol, chapterCol, verseCol, textCol] = ["Book", "Chapter", "Verse", "Text"].map(col);

  const books: ParsedBook[] = [];
  const verses: ParsedVerse[] = [];
  const skipped = new Set<string>();

  for (const row of rows) {
    const name = row[bookCol];
    const book = SCROLLMAPPER_BOOKS[name];
    if (!book) {
      skipped.add(name);
      continue;
    }
    if (books.at(-1)?.book !== book) books.push({ book, order: books.length + 1, intro: null });
    const text = row[textCol].replace(/\s+/g, " ").trim();
    if (!text) continue;
    verses.push({
      book,
      chapter: Number(row[chapterCol]),
      verse: Number(row[verseCol]),
      part: "",
      label: null,
      text,
      isPoetry: false,
      paragraphEnd: false,
    });
  }
  return { books, verses, headings: [], skippedBooks: [...skipped] };
}
