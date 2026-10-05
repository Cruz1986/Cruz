import { describe, expect, it } from "vitest";
import {
  buildSequence,
  clampIndex,
  decadeStarts,
  mysteriesFor,
  parseProgress,
  type RosaryStepConfig,
} from "@/lib/rosary/sequence";

const step = (phase: RosaryStepConfig["phase"], prayerSlug: string | null, repeat = 1): RosaryStepConfig => ({
  phase,
  prayerSlug,
  repeat,
  labelEn: null,
  labelTa: null,
});

const STEPS = [
  step("opening", "sign-of-the-cross"),
  step("opening", "apostles-creed"),
  step("opening", "our-father"),
  step("opening", "hail-mary", 3),
  step("opening", "glory-be"),
  step("decade", null),
  step("decade", "our-father"),
  step("decade", "hail-mary", 10),
  step("decade", "glory-be"),
  step("decade", "fatima-prayer"),
  step("closing", "hail-holy-queen"),
  step("closing", "rosary-concluding-prayer"),
  step("closing", "sign-of-the-cross"),
];

describe("buildSequence", () => {
  const seq = buildSequence(STEPS);

  it("has the right number of prayers", () => {
    // 7 opening + 5 × (1 + 1 + 10 + 1 + 1) + 3 closing
    expect(seq).toHaveLength(7 + 5 * 14 + 3);
    expect(seq.filter((p) => p.prayerSlug === "hail-mary")).toHaveLength(53);
  });

  it("counts Hail Marys within each decade", () => {
    const third = seq.filter((p) => p.decade === 3 && p.prayerSlug === "hail-mary");
    expect(third.map((p) => p.count)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(third.every((p) => p.of === 10)).toBe(true);
  });

  it("starts each decade by announcing the mystery", () => {
    expect(decadeStarts(seq).map((i) => seq[i].prayerSlug)).toEqual([null, null, null, null, null]);
    expect(decadeStarts(seq)[0]).toBe(7);
  });

  it("keeps indices in range", () => {
    expect(clampIndex(-3, seq.length)).toBe(0);
    expect(clampIndex(999, seq.length)).toBe(seq.length - 1);
    expect(clampIndex(Number.NaN, seq.length)).toBe(0);
  });
});

describe("saved progress", () => {
  const now = 1_800_000_000_000;
  it("accepts recent progress", () => {
    expect(parseProgress(JSON.stringify({ set: "joyful", index: 12, savedAt: now - 1000 }), now)).toEqual({
      set: "joyful",
      index: 12,
      savedAt: now - 1000,
    });
  });
  it("ignores stale or malformed progress", () => {
    expect(parseProgress(JSON.stringify({ set: "joyful", index: 12, savedAt: now - 2 * 86_400_000 }), now)).toBeNull();
    expect(parseProgress("{nope", now)).toBeNull();
    expect(parseProgress(JSON.stringify({ set: 1 }), now)).toBeNull();
  });
});

describe("mysteriesFor", () => {
  const sets = [
    { key: "joyful" as const, weekdays: [1, 6] },
    { key: "luminous" as const, weekdays: [4] },
    { key: "sorrowful" as const, weekdays: [2, 5] },
    { key: "glorious" as const, weekdays: [3, 7] },
  ];
  it.each([
    [1, "ordinary", "joyful"],
    [4, "ordinary", "luminous"],
    [5, "lent", "sorrowful"],
    [7, "ordinary", "glorious"],
    [7, "lent", "sorrowful"],
    [7, "advent", "joyful"],
    [7, "christmas", "joyful"],
    [7, "easter", "glorious"],
  ])("weekday %i in %s → %s", (weekday, season, expected) => {
    expect(mysteriesFor(weekday, season, sets)).toBe(expected);
  });
});
