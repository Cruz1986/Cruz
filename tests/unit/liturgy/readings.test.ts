import { describe, expect, it } from "vitest";
import {
  assembleMasses,
  formatRanges,
  toSlots,
  visibleSlots,
  vkeyRanges,
  type LectionaryReading,
  type MassSet,
} from "@/lib/liturgy/readings";
import type { ReadingType } from "@/lib/liturgy/lectionary";

const reading = (type: ReadingType, reference: string, extra: Partial<LectionaryReading> = {}): LectionaryReading => ({
  type,
  sequence: 1,
  altGroup: 0,
  isShort: false,
  isProper: false,
  sourceType: "1",
  reference,
  ranges: [],
  ...extra,
});

const set = (role: MassSet["role"], readings: LectionaryReading[], extra: Partial<MassSet> = {}): MassSet => ({
  massKey: "day",
  role,
  celebrationCode: null,
  setCode: "x",
  readings,
  ...extra,
});

const refs = (slots: ReturnType<typeof toSlots>) =>
  slots.map((s) => `${s.type}${s.sequence > 1 ? s.sequence : ""}:${s.options.map((o) => o.reference).join("|")}`);

describe("assembleMasses", () => {
  it("merges base sets in liturgical order", () => {
    const { masses } = assembleMasses(
      [
        set("base", [reading("acclamation", "A")]),
        set("base", [reading("gospel", "G"), reading("first", "R1"), reading("psalm", "P"), reading("second", "R2")]),
      ],
      { weekdayFeast: false },
    );
    expect(refs(masses[0].slots)).toEqual(["first:R1", "psalm:P", "second:R2", "acclamation:A", "gospel:G"]);
  });

  it("offers alternatives and shorter forms in one slot", () => {
    const { masses } = assembleMasses(
      [
        set("base", [
          reading("second", "long", { altGroup: 1, sourceType: "3.1" }),
          reading("second", "short", { altGroup: 1, isShort: true, sourceType: "3.11" }),
        ]),
      ],
      { weekdayFeast: false },
    );
    expect(refs(masses[0].slots)).toEqual(["second:long|short"]);
  });

  it("replaces weekday readings with a memorial's proper ones, and the acclamation with the Gospel", () => {
    const { masses, memorials } = assembleMasses(
      [
        set("base", [
          reading("first", "weekday R1"),
          reading("psalm", "weekday P"),
          reading("acclamation", "weekday A"),
          reading("gospel", "weekday G"),
        ]),
        set(
          "memorial",
          [
            reading("gospel", "proper G", { isProper: true, sourceType: "6.009" }),
            reading("acclamation", "memorial A"),
            reading("first", "optional R1"),
          ],
          {
            celebrationCode: "Saint Mary Magdalene",
          },
        ),
      ],
      { weekdayFeast: false },
    );
    expect(refs(masses[0].slots)).toEqual([
      "first:weekday R1",
      "psalm:weekday P",
      "acclamation:memorial A",
      "gospel:proper G",
    ]);
    expect(memorials[0].celebrationCode).toBe("Saint Mary Magdalene");
    expect(refs(memorials[0].slots)).toEqual(["first:optional R1", "acclamation:memorial A"]);
  });

  it("lists the Commons a memorial may use", () => {
    const { memorials } = assembleMasses([set("memorial", [reading("commons", "_Martyr or _Virgin")])], {
      weekdayFeast: false,
    });
    expect(memorials[0].commons).toEqual(["_Martyr", "_Virgin"]);
  });

  it("gives feasts on weekdays one reading before the Gospel", () => {
    const { masses } = assembleMasses(
      [set("base", [reading("first", "R1"), reading("psalm", "P"), reading("second", "R2"), reading("gospel", "G")])],
      {
        weekdayFeast: true,
      },
    );
    expect(refs(masses[0].slots)).toEqual(["first:R1|R2", "psalm:P", "gospel:G"]);
  });

  it("interleaves the Easter Vigil readings and psalms", () => {
    const slots = toSlots([
      reading("first", "R1", { sequence: 1 }),
      reading("first", "R2", { sequence: 2 }),
      reading("psalm", "P1", { sequence: 1 }),
      reading("psalm", "P2", { sequence: 2 }),
      reading("gospel", "G"),
      reading("acclamation", "A"),
    ]);
    expect(refs(slots)).toEqual(["first:R1", "psalm:P1", "first2:R2", "psalm2:P2", "acclamation:A", "gospel:G"]);
  });

  it("keeps Masses in order (Christmas)", () => {
    const { masses } = assembleMasses(
      [
        set("base", [reading("gospel", "day")], { massKey: "day" }),
        set("base", [reading("gospel", "night")], { massKey: "night" }),
        set("base", [reading("gospel", "vigil")], { massKey: "vigil" }),
      ],
      { weekdayFeast: false },
    );
    expect(masses.map((m) => m.key)).toEqual(["vigil", "night", "day"]);
  });
});

describe("ranges", () => {
  const r = (book: string, sc: number, sv: number, ec: number, ev: number, sp = "", ep = "") => ({
    book,
    startChapter: sc,
    startVerse: sv,
    startPart: sp,
    endChapter: ec,
    endVerse: ev,
    endPart: ep,
  });
  const abbr = (code: string) => ({ ISA: "Isa", PSA: "Ps", "1CH": "1 Chr", "2CH": "2 Chr" })[code] ?? code;

  it("formats references in English", () => {
    expect(formatRanges([r("ISA", 58, 7, 58, 10)], abbr)).toBe("Isa 58:7-10");
    expect(formatRanges([r("PSA", 112, 4, 112, 5), r("PSA", 112, 8, 112, 8, "a", "a")], abbr)).toBe("Ps 112:4-5, 8a");
    expect(formatRanges([r("1CH", 15, 3, 15, 4), r("1CH", 16, 1, 16, 2)], abbr)).toBe("1 Chr 15:3-4; 16:1-2");
    expect(formatRanges([r("2CH", 5, 13, 6, 2)], abbr)).toBe("2 Chr 5:13 – 6:2");
  });

  it("converts to canonical verse keys", () => {
    expect(vkeyRanges([r("ISA", 58, 7, 58, 10)], new Map([["ISA", 29]]))).toEqual([[29058007, 29058010]]);
  });
});

describe("visibleSlots", () => {
  it("hides internal pointers but keeps sequences and references", () => {
    const slots = toSlots([
      reading("procession_gospel", "LW06-6Sat~1"),
      reading("sequence", "Victimae"),
      reading("gospel", "யோவா20:1-9", {
        ranges: [
          { book: "JHN", startChapter: 20, startVerse: 1, startPart: "", endChapter: 20, endVerse: 9, endPart: "" },
        ],
      }),
    ]);
    expect(visibleSlots(slots).map((s) => s.type)).toEqual(["sequence", "gospel"]);
  });
});
