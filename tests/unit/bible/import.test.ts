import { describe, expect, it } from "vitest";
import { parseCsv, parseScrollmapperCsv } from "@/scripts/import/bible/scrollmapper-csv";
import { psalmTitleVerses, toCanonical, vulgatePsalmToHebrew } from "@/scripts/import/bible/versification";
import { validateTranslation } from "@/scripts/import/bible/validate";
import type { ParsedTranslation } from "@/scripts/import/bible/types";

describe("CSV", () => {
  it("handles quotes, commas and newlines", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi""\nthen"\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"\nthen'],
    ]);
  });

  it("maps scrollmapper book names and skips non-canonical books", () => {
    const parsed = parseScrollmapperCsv("Book,Chapter,Verse,Text\nI Samuel,1,1,Text one\nLaodiceans,1,1,x\n");
    expect(parsed.verses.map((v) => v.book)).toEqual(["1SA"]);
    expect(parsed.skippedBooks).toEqual(["Laodiceans"]);
  });
});

describe("Vulgate → canonical versification", () => {
  it.each([
    [
      [22, 1],
      [23, 1],
    ],
    [
      [9, 22],
      [10, 1],
    ],
    [
      [113, 9],
      [115, 1],
    ],
    [
      [115, 1],
      [116, 10],
    ],
    [
      [147, 1],
      [147, 12],
    ],
    [
      [150, 6],
      [150, 6],
    ],
  ])("Vulgate psalm %j is Hebrew %j", ([c, v], expected) => {
    expect(vulgatePsalmToHebrew(c, v)).toEqual({ chapter: expected[0], verse: expected[1] });
  });

  it("moves titled psalms back by their title verses", () => {
    expect(psalmTitleVerses(3)).toBe(1);
    expect(psalmTitleVerses(51)).toBe(2);
    expect(psalmTitleVerses(23)).toBe(0);
    expect(toCanonical("vulgate", { book: "PSA", chapter: 3, verse: 2 })).toEqual({
      book: "PSA",
      chapter: 3,
      verse: 1,
    });
    expect(toCanonical("vulgate", { book: "PSA", chapter: 3, verse: 1 })).toEqual({
      book: "PSA",
      chapter: 3,
      verse: 0,
    });
    expect(toCanonical("vulgate", { book: "PSA", chapter: 50, verse: 3 })).toEqual({
      book: "PSA",
      chapter: 51,
      verse: 1,
    });
  });

  it("does not apply a title offset to the second half of a split psalm", () => {
    expect(toCanonical("vulgate", { book: "PSA", chapter: 115, verse: 1 })).toEqual({
      book: "PSA",
      chapter: 116,
      verse: 10,
    });
  });

  it("maps the Greek additions to Daniel", () => {
    expect(toCanonical("vulgate", { book: "DAN", chapter: 3, verse: 24 })).toEqual({
      book: "DAG",
      chapter: 1,
      verse: 1,
    });
    expect(toCanonical("vulgate", { book: "DAN", chapter: 3, verse: 91 })).toEqual({
      book: "DAN",
      chapter: 3,
      verse: 24,
    });
    expect(toCanonical("vulgate", { book: "DAN", chapter: 3, verse: 98 })).toEqual({
      book: "DAN",
      chapter: 4,
      verse: 1,
    });
    expect(toCanonical("vulgate", { book: "DAN", chapter: 4, verse: 1 })).toEqual({
      book: "DAN",
      chapter: 4,
      verse: 4,
    });
    expect(toCanonical("vulgate", { book: "DAN", chapter: 13, verse: 5 })).toEqual({
      book: "DAG",
      chapter: 2,
      verse: 5,
    });
  });

  it("leaves canonical sources unchanged", () => {
    expect(toCanonical("canonical", { book: "PSA", chapter: 22, verse: 1 })).toEqual({
      book: "PSA",
      chapter: 22,
      verse: 1,
    });
  });
});

describe("validation", () => {
  const verse = (book: string, chapter: number, v: number, text = "x") => ({
    book,
    chapter,
    verse: v,
    part: "",
    label: null,
    text,
    isPoetry: false,
    paragraphEnd: false,
  });
  const base = (verses: ParsedTranslation["verses"]): ParsedTranslation => ({
    books: [{ book: "GEN", order: 1, intro: null }],
    verses,
    headings: [],
  });
  const known = new Set(["GEN"]);

  it("accepts a clean translation", () => {
    expect(validateTranslation(base([verse("GEN", 1, 1), verse("GEN", 1, 2), verse("GEN", 2, 1)]), known)).toEqual([]);
  });

  it("reports duplicates, empty text, unknown books and chapter gaps as errors", () => {
    const issues = validateTranslation(
      base([verse("GEN", 1, 1), verse("GEN", 1, 1), verse("GEN", 3, 1, " "), verse("XYZ", 1, 1)]),
      known,
    );
    const errors = issues.filter((i) => i.level === "error").map((i) => i.message);
    expect(errors).toEqual(
      expect.arrayContaining([
        "GEN 1:1: duplicate verse",
        "GEN 3:1: empty text",
        "XYZ 1:1: book not in book list",
        "GEN: chapters are not continuous (found 3 at position 2)",
      ]),
    );
  });

  it("reports verse gaps as warnings and allows a prologue chapter 0", () => {
    const issues = validateTranslation(base([verse("GEN", 0, 1), verse("GEN", 1, 1), verse("GEN", 1, 3)]), known);
    expect(issues).toEqual([{ level: "warning", message: "GEN 1: no verse 2" }]);
  });
});
