import { describe, expect, it } from "vitest";
import { lifeSpan, nextFeastDate, saintsOfDay, searchSaints, type SaintSummary } from "@/lib/saints/helpers";

const saint = (id: string, over: Partial<SaintSummary> = {}): SaintSummary & { id: string } => ({
  id,
  slug: id,
  nameEn: `Saint ${id}`,
  nameTa: `புனித ${id}`,
  titleEn: null,
  titleTa: null,
  feastMonth: 1,
  feastDay: 1,
  patronageEn: null,
  patronageTa: null,
  ...over,
});

describe("nextFeastDate", () => {
  const today = { year: 2026, month: 10, day: 5 };
  it("keeps today and later dates in this year", () => {
    expect(nextFeastDate(10, 5, today)).toEqual({ year: 2026, month: 10, day: 5 });
    expect(nextFeastDate(12, 3, today)).toEqual({ year: 2026, month: 12, day: 3 });
  });
  it("moves earlier dates to next year", () => {
    expect(nextFeastDate(1, 25, today)).toEqual({ year: 2027, month: 1, day: 25 });
  });
  it("waits for a leap year for 29 February", () => {
    expect(nextFeastDate(2, 29, today)).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe("lifeSpan", () => {
  it("formats the known years", () => {
    expect(lifeSpan(1506, 1552)).toBe("1506–1552");
    expect(lifeSpan(null, 1552)).toBe("† 1552");
    expect(lifeSpan(1256, null)).toBe("b. 1256");
    expect(lifeSpan(null, null)).toBeNull();
  });
});

describe("searchSaints", () => {
  const list = [
    saint("francis", { nameEn: "Saint Francis Xavier", nameTa: "புனித பிரான்சிஸ் சவேரியார்", patronageEn: "India" }),
    saint("thomas", { nameEn: "Saint Thomas", nameTa: "புனித தோமா", titleEn: "apostle", patronageEn: "India" }),
    saint("agnes", { nameEn: "Saint Agnes", nameTa: "புனித ஆக்னெஸ்" }),
  ];
  it("matches names in either language, ignoring case", () => {
    expect(searchSaints(list, "xavier").map((s) => s.id)).toEqual(["francis"]);
    expect(searchSaints(list, "தோமா").map((s) => s.id)).toEqual(["thomas"]);
  });
  it("matches titles and patronage after names", () => {
    expect(searchSaints(list, "apostle").map((s) => s.id)).toEqual(["thomas"]);
    expect(searchSaints(list, "india").map((s) => s.id)).toEqual(["francis", "thomas"]);
  });
  it("returns everything for an empty query", () => {
    expect(searchSaints(list, "  ")).toHaveLength(3);
  });
});

describe("saintsOfDay", () => {
  const peter = saint("peter", { feastMonth: 6, feastDay: 29 });
  const paul = saint("paul", { feastMonth: 6, feastDay: 29 });
  const joseph = saint("joseph", { feastMonth: 3, feastDay: 19 });
  it("puts celebrated saints first, then others on their feast date", () => {
    const day = { year: 2026, month: 6, day: 29 };
    expect(saintsOfDay(day, ["peter"], [paul, peter, joseph]).map((s) => s.id)).toEqual(["peter", "paul"]);
  });
  it("includes a saint whose celebration was moved to another day", () => {
    const day = { year: 2027, month: 3, day: 20 };
    expect(saintsOfDay(day, ["joseph"], [joseph]).map((s) => s.id)).toEqual(["joseph"]);
  });
  it("does not repeat a saint", () => {
    const day = { year: 2026, month: 3, day: 19 };
    expect(saintsOfDay(day, ["joseph", "joseph"], [joseph])).toHaveLength(1);
  });
});

describe("excerpt", () => {
  it("keeps the first sentence", async () => {
    const { excerpt } = await import("@/lib/saints/helpers");
    expect(excerpt("Bishop of Hippo. He wrote much.")).toBe("Bishop of Hippo.");
  });
  it("shortens a long sentence at a word", async () => {
    const { excerpt } = await import("@/lib/saints/helpers");
    expect(excerpt("one two three four five six.", 12)).toBe("one two…");
  });
});
