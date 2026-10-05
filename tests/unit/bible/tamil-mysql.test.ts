import { describe, expect, it } from "vitest";
import { cleanVerseText, parseHeading, parseTamilMysql, unescapeMysql } from "@/scripts/import/bible/tamil-mysql";

// Synthetic fixtures in the dump's format (no Bible text).
const BOOKKEY = `INSERT INTO \`t_bookkey\` (\`bn\`, \`osis_id\`, \`en\`, \`tn_f\`, \`tn_s\`, \`tn_a\`, \`tn_o\`, \`intro\`) VALUES
(1, 'Gen', 'Genesis', 'அ', 'அ', 'அ', NULL, '<p>முன்னுரை</p>'),
(19, 'Ps', 'Psalms', 'ஆ', 'ஆ', 'ஆ', 'பழைய', ''),
(100, '', 'Preface', 'இ', 'இ', 'இ', NULL, '');`;

const VERSES = `INSERT INTO \`t_mybibleview\` (\`verse_id\`, \`txt\`, \`type\`) VALUES
(01001000, 'தலைப்பு ஒன்று', 'T'),
(01001001, 'முதல் வரி. இரண்டாம் \\"சொல்\\".⒫', 'V'),
(01001002, '❮2-3❯இணைந்த வசனம்*', 'V'),
(19003000, 'முதல் பகுதி⒣காலை மன்றாட்டு§(குறிப்பு)', 'T'),
(19003001, '⁽ஒன்று␢ இரண்டு⁾', 'V');`;

const OSIS = new Map([
  ["Gen", "GEN"],
  ["Ps", "PSA"],
]);

describe("Tamil MySQL parser", () => {
  it("unescapes MySQL string literals", () => {
    expect(unescapeMysql(String.raw`a\'b\"c\\d`)).toBe(`a'b"c\\d`);
  });

  it("turns markers into text and layout flags", () => {
    expect(cleanVerseText("⁽ஒன்று␢ இரண்டு⁾⒫")).toEqual({
      label: null,
      text: "ஒன்று\nஇரண்டு",
      isPoetry: true,
      paragraphEnd: true,
    });
    expect(cleanVerseText("❮4-5❯உரை*")).toEqual({ label: "4-5", text: "உரை", isPoetry: false, paragraphEnd: false });
  });

  it("splits section titles and notes in headings", () => {
    expect(parseHeading("முதல் பகுதி⒣காலை§(குறிப்பு)")).toEqual([
      { level: 1, text: "முதல் பகுதி" },
      { level: 2, text: "காலை\n(குறிப்பு)" },
    ]);
  });

  it("parses books, verses and headings", () => {
    const parsed = parseTamilMysql(BOOKKEY, VERSES, OSIS);
    expect(parsed.books).toEqual([
      { book: "GEN", order: 1, intro: "<p>முன்னுரை</p>" },
      { book: "PSA", order: 2, intro: null },
    ]);
    expect(parsed.verses.map((v) => [v.book, v.chapter, v.verse, v.label])).toEqual([
      ["GEN", 1, 1, null],
      ["GEN", 1, 2, "2-3"],
      ["PSA", 3, 1, null],
    ]);
    expect(parsed.verses[0].text).toBe('முதல் வரி. இரண்டாம் "சொல்".');
    expect(parsed.headings).toHaveLength(3);
    expect(parsed.headings[0]).toEqual({ book: "GEN", chapter: 1, beforeVerse: 0, level: 2, text: "தலைப்பு ஒன்று" });
  });
});
