import { describe, expect, it } from "vitest";
import { buildAliasIndex, parseReference } from "@/lib/bible/reference";
import { biblePath, bookFromSlug, chapterFromSlug } from "@/lib/bible/paths";
import { normalizeText } from "@/lib/bible/text";
import { rangeLabel } from "@/components/bible/verse-selection";

const aliases = buildAliasIndex([
  { alias: "John", code: "JHN" },
  { alias: "Jn", code: "JHN" },
  { alias: "1 Sam", code: "1SA" },
  { alias: "யோவா", code: "JHN" },
  { alias: "திருப்பாடல்கள்", code: "PSA" },
]);

describe("parseReference", () => {
  it.each([
    ["John 3:16", { book: "JHN", chapter: 3, verse: 16, verseEnd: null }],
    ["jn 3.16-18", { book: "JHN", chapter: 3, verse: 16, verseEnd: 18 }],
    ["1 Sam 3", { book: "1SA", chapter: 3, verse: null, verseEnd: null }],
    ["யோவா 3:16", { book: "JHN", chapter: 3, verse: 16, verseEnd: null }],
    ["திருப்பாடல்கள் 23", { book: "PSA", chapter: 23, verse: null, verseEnd: null }],
  ])("parses %s", (input, expected) => {
    expect(parseReference(input, aliases)).toEqual(expected);
  });

  it.each(["shepherd", "John", "Unknown 3:16", "John 3:16-10", "3:16"])("rejects %s", (input) => {
    expect(parseReference(input, aliases)).toBeNull();
  });
});

describe("paths", () => {
  it("round-trips book codes and chapters", () => {
    expect(biblePath("en-drc", "1SA", 3, 7)).toBe("/bible/en-drc/1sa/3#v7");
    expect(bookFromSlug("1sa")).toBe("1SA");
    expect(bookFromSlug("../x")).toBeNull();
    expect(chapterFromSlug("0")).toBe(0);
    expect(chapterFromSlug("3a")).toBeNull();
  });
});

describe("text", () => {
  it("normalises like the database", () => {
    expect(normalizeText("  Hello​  WORLD ")).toBe("hello world");
    expect(normalizeText("கொ".normalize("NFD"))).toBe("கொ");
  });
});

describe("rangeLabel", () => {
  it("compresses consecutive verses", () => {
    const v = (n: number) => ({ verse: n, label: String(n) });
    expect(rangeLabel([v(3), v(4), v(5), v(8)])).toBe("3-5, 8");
    expect(rangeLabel([v(16)])).toBe("16");
  });
});
