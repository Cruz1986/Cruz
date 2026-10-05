import { describe, expect, it } from "vitest";
import { queryWords, referenceKeys, snippet } from "@/lib/search/snippet";

describe("search helpers", () => {
  it("splits queries like the database does", () => {
    expect(queryWords("  Hail  MARY a ")).toEqual(["hail", "mary"]);
    expect(queryWords("தூய மரியா")).toEqual(["தூய", "மரியா"]);
    expect(queryWords("x")).toEqual([]);
  });

  it("keeps short texts whole", () => {
    expect(snippet("Our Father,\nwho art in heaven", ["father"])).toBe("Our Father, who art in heaven");
  });

  it("cuts around the first match at word boundaries", () => {
    const text = `${"lorem ipsum ".repeat(30)}the word mercy appears here ${"dolor sit ".repeat(30)}`;
    const s = snippet(text, ["mercy"], 60);
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s).toContain("mercy");
    expect(s.length).toBeLessThanOrEqual(62);
  });

  it("computes verse keys of a reference", () => {
    expect(referenceKeys(50, { chapter: 3, verse: 16, verseEnd: null })).toEqual([50003016, 50003016]);
    expect(referenceKeys(50, { chapter: 3, verse: 14, verseEnd: 21 })).toEqual([50003014, 50003021]);
    expect(referenceKeys(23, { chapter: 23, verse: null, verseEnd: null })).toEqual([23023001, 23023999]);
  });
});
