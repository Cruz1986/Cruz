/**
 * Lectionary helpers shared by the importer and the app.
 *
 * Reading lists come from Tamil-Catholic-Lectionary: one set per day ID ("OW05-0Sun A",
 * "Saint Agnes, virgin and martyr", "_Martyr" for a Common…) holding readings with numeric
 * type codes, and references in the Tamil Bible's abbreviations and numbering.
 */

export type ReadingType =
  "first" | "psalm" | "second" | "sequence" | "acclamation" | "gospel" | "procession_gospel" | "commons";

export type DecodedType = {
  readingType: ReadingType;
  sequence: number;
  altGroup: number;
  isShort: boolean;
  isProper: boolean;
};

const GENERAL: Record<string, ReadingType> = {
  "0": "procession_gospel",
  "1": "first",
  "2": "psalm",
  "3": "second",
  "4": "sequence",
  "5": "acclamation",
  "6": "gospel",
  "9": "commons",
};
// In the Commons, 2 = New Testament first readings (Easter season).
const COMMONS: Record<string, ReadingType> = {
  "1": "first",
  "2": "first",
  "3": "psalm",
  "4": "second",
  "5": "acclamation",
  "6": "gospel",
};

/**
 * Decodes a lectionary type code such as "1", "3.11", "1.109" or (in a Common) "1.0506".
 *  - integer part: kind of reading
 *  - first fraction digit: alternative (or, at the Easter Vigil, the reading's number)
 *  - second fraction digit: a shorter form
 *  - third fraction digit 1 or 9: a reading proper to a memorial, which replaces the weekday's
 */
export function decodeReadingType(setCode: string, raw: string): DecodedType | null {
  const [whole, fraction = ""] = raw.split(".");
  const commons = setCode.startsWith("_");
  const readingType = (commons ? COMMONS : GENERAL)[whole];
  if (!readingType) return null;

  if (commons) {
    return {
      readingType,
      sequence: whole === "2" ? 2 : 1,
      altGroup: Number(fraction.slice(0, 2) || 0),
      isShort: fraction.length > 2,
      isProper: false,
    };
  }
  const isProper = fraction.length >= 3 && (fraction[2] === "1" || fraction[2] === "9");
  if (setCode.startsWith("LW06-6Sat")) {
    // Easter Vigil: 1.1 … 1.8 are the readings in order; 1.11 is the shorter form of 1.1.
    return {
      readingType,
      sequence: Number(fraction[0] || 1),
      altGroup: 0,
      isShort: fraction[1] === "1",
      isProper: false,
    };
  }
  return {
    readingType,
    sequence: 1,
    altGroup: Number(fraction[0] || 0),
    isShort: !isProper && fraction.length >= 2 && fraction[1] !== "0",
    isProper,
  };
}

export type VerseRange = {
  book: string;
  startChapter: number;
  startVerse: number;
  startPart: string;
  endChapter: number;
  endVerse: number;
  endPart: string;
};

const ITEM = /^(\d+)([a-z]*)(?:-(?:(\d+):)?(\d+)([a-z]*))?$/;

/**
 * Parses references like "எசா58:7-10", "திபா112:4-5.6-7.8a,9", "1குறி15:3-4,15-16;16:1-2",
 * "2குறி5:6-8,9b-10,13-6:2" into contiguous ranges. "." and "," both separate items (in psalms
 * "." separates stanzas); ";" starts a new chapter; a trailing note such as "காண்க" (see) is ignored.
 * Returns null when the book is unknown or the text is not a reference.
 */
export function parseLectionaryReference(raw: string, books: ReadonlyMap<string, string>): VerseRange[] | null {
  const text = raw.normalize("NFC").replace(/\s+/g, "");
  const head = /^([1-3]?[^\d:;,.]+?)(\d.*)$/.exec(text);
  if (!head) return null;
  const book = books.get(head[1]);
  if (!book) return null;

  const body = head[2].replace(/[^\d:;,.\-a-z]+$/u, "");
  const ranges: VerseRange[] = [];
  for (const chapterPart of body.split(";")) {
    const m = /^(\d+):(.+)$/.exec(chapterPart);
    if (!m) {
      // A whole chapter, e.g. "திபா23"
      if (/^\d+$/.test(chapterPart)) {
        const c = Number(chapterPart);
        ranges.push({ book, startChapter: c, startVerse: 1, startPart: "", endChapter: c, endVerse: 999, endPart: "" });
        continue;
      }
      return null;
    }
    let chapter = Number(m[1]);
    for (const item of m[2].split(/[.,]/).filter(Boolean)) {
      const v = ITEM.exec(item);
      if (!v) return null;
      const endChapter = v[3] ? Number(v[3]) : chapter;
      ranges.push({
        book,
        startChapter: chapter,
        startVerse: Number(v[1]),
        startPart: v[2],
        endChapter,
        endVerse: v[4] ? Number(v[4]) : Number(v[1]),
        endPart: v[4] ? v[5] : v[2],
      });
      chapter = endChapter;
    }
  }
  return ranges.length ? ranges : null;
}

/** Lectionary set IDs that may hold readings for a calendar code (before checking they exist). */
export function lectionaryCandidates(
  code: string,
  { sundayCycle, weekdayCycle }: { sundayCycle: string; weekdayCycle: "I" | "II" },
): string[] {
  // Roman-Calendar v5 numbers 17–24 December as Advent week 4; the lectionary data uses week 5.
  const id = code.replace(/^AW04-Dec/, "AW05-Dec");
  const candidates = [id, `${id} ${sundayCycle}`];
  if (/^OW\d{2}-[1-6][A-Za-z]{3}/.test(id)) candidates.push(`${id} ${weekdayCycle === "I" ? 1 : 2}`);
  return candidates;
}

export const MASS_SETS: Readonly<Record<string, { key: "vigil" | "night" | "dawn" | "day"; set: string }[]>> = {
  "Nativity of the Lord": [
    { key: "vigil", set: "Nativity of the Lord 1" },
    { key: "night", set: "Nativity of the Lord 2" },
    { key: "dawn", set: "Nativity of the Lord 3" },
    { key: "day", set: "Nativity of the Lord 4" },
  ],
};
