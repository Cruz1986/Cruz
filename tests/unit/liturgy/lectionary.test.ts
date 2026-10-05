import { describe, expect, it } from "vitest";
import { decodeReadingType, lectionaryCandidates, parseLectionaryReference } from "@/lib/liturgy/lectionary";

const BOOKS = new Map([
  ["எசா", "ISA"],
  ["திபா", "PSA"],
  ["1குறி", "1CH"],
  ["2குறி", "2CH"],
  ["லூக்", "LUK"],
]);

describe("decodeReadingType", () => {
  it.each([
    ["OW05-0Sun A", "1", { readingType: "first", sequence: 1, altGroup: 0, isShort: false, isProper: false }],
    ["OW05-0Sun C", "3.11", { readingType: "second", sequence: 1, altGroup: 1, isShort: true, isProper: false }],
    ["EW01-0Sun", "3.2", { readingType: "second", sequence: 1, altGroup: 2, isShort: false, isProper: false }],
    ["Saint X", "1.109", { readingType: "first", sequence: 1, altGroup: 1, isShort: false, isProper: true }],
    ["Saint X", "6.009", { readingType: "gospel", sequence: 1, altGroup: 0, isShort: false, isProper: true }],
    ["LW06-6Sat", "1.21", { readingType: "first", sequence: 2, altGroup: 0, isShort: true, isProper: false }],
    [
      "LW06-0Sun A",
      "0",
      { readingType: "procession_gospel", sequence: 1, altGroup: 0, isShort: false, isProper: false },
    ],
    ["_Martyr", "2.01", { readingType: "first", sequence: 2, altGroup: 1, isShort: false, isProper: false }],
    ["_Pastor", "1.0506", { readingType: "first", sequence: 1, altGroup: 5, isShort: true, isProper: false }],
  ])("%s %s", (set, type, expected) => {
    expect(decodeReadingType(set, type)).toEqual(expected);
  });

  it("rejects unknown kinds", () => {
    expect(decodeReadingType("X", "7")).toBeNull();
  });
});

describe("parseLectionaryReference", () => {
  const r = (book: string, sc: number, sv: number, sp: string, ec: number, ev: number, ep: string) => ({
    book,
    startChapter: sc,
    startVerse: sv,
    startPart: sp,
    endChapter: ec,
    endVerse: ev,
    endPart: ep,
  });

  it("parses a simple range", () => {
    expect(parseLectionaryReference("எசா58:7-10", BOOKS)).toEqual([r("ISA", 58, 7, "", 58, 10, "")]);
  });

  it("parses psalm stanzas and verse parts", () => {
    expect(parseLectionaryReference("திபா112:4-5.6-7.8a,9", BOOKS)).toEqual([
      r("PSA", 112, 4, "", 112, 5, ""),
      r("PSA", 112, 6, "", 112, 7, ""),
      r("PSA", 112, 8, "a", 112, 8, "a"),
      r("PSA", 112, 9, "", 112, 9, ""),
    ]);
  });

  it("follows chapter changes", () => {
    expect(parseLectionaryReference("1குறி15:3-4,15-16;16:1-2", BOOKS)).toEqual([
      r("1CH", 15, 3, "", 15, 4, ""),
      r("1CH", 15, 15, "", 15, 16, ""),
      r("1CH", 16, 1, "", 16, 2, ""),
    ]);
    expect(parseLectionaryReference("2குறி5:13-6:2", BOOKS)).toEqual([r("2CH", 5, 13, "", 6, 2, "")]);
  });

  it("ignores a trailing note", () => {
    expect(parseLectionaryReference("லூக்1:45காண்க", BOOKS)).toEqual([r("LUK", 1, 45, "", 1, 45, "")]);
  });

  it.each(["_Martyr or _Virgin", "Victimae", "AW01-1Mon", "யாரோ3:1"])("rejects %s", (raw) => {
    expect(parseLectionaryReference(raw, BOOKS)).toBeNull();
  });
});

describe("lectionaryCandidates", () => {
  it("adds the Sunday and weekday cycles", () => {
    expect(lectionaryCandidates("OW05-0Sun", { sundayCycle: "A", weekdayCycle: "II" })).toEqual([
      "OW05-0Sun",
      "OW05-0Sun A",
    ]);
    expect(lectionaryCandidates("OW05-1Mon", { sundayCycle: "A", weekdayCycle: "II" })).toEqual([
      "OW05-1Mon",
      "OW05-1Mon A",
      "OW05-1Mon 2",
    ]);
  });

  it("maps 17–24 December to the lectionary's numbering", () => {
    expect(lectionaryCandidates("AW04-Dec17", { sundayCycle: "B", weekdayCycle: "I" })[0]).toBe("AW05-Dec17");
  });
});
