/**
 * The guided Rosary as a flat list of positions built from the configured steps (pure; tested).
 * Each position is one prayer said once: e.g. the 7th Hail Mary of the 3rd decade.
 */

export type RosaryStepConfig = {
  phase: "opening" | "decade" | "closing";
  prayerSlug: string | null; // null = announce the mystery
  repeat: number;
  labelEn: string | null;
  labelTa: string | null;
};

export type RosaryPosition = {
  index: number;
  phase: RosaryStepConfig["phase"];
  /** 1–5 during the decades, otherwise null. */
  decade: number | null;
  prayerSlug: string | null;
  /** 1-based count within a repeated prayer (Hail Mary 1–10), and how many there are. */
  count: number;
  of: number;
  labelEn: string | null;
  labelTa: string | null;
};

export function buildSequence(steps: RosaryStepConfig[]): RosaryPosition[] {
  const positions: RosaryPosition[] = [];
  const push = (step: RosaryStepConfig, decade: number | null) => {
    for (let count = 1; count <= step.repeat; count++) {
      positions.push({
        index: positions.length,
        phase: step.phase,
        decade,
        prayerSlug: step.prayerSlug,
        count,
        of: step.repeat,
        labelEn: step.labelEn,
        labelTa: step.labelTa,
      });
    }
  };
  for (const step of steps.filter((s) => s.phase === "opening")) push(step, null);
  for (let decade = 1; decade <= 5; decade++)
    for (const step of steps.filter((s) => s.phase === "decade")) push(step, decade);
  for (const step of steps.filter((s) => s.phase === "closing")) push(step, null);
  return positions;
}

export const clampIndex = (index: number, length: number) =>
  Math.min(Math.max(0, Math.trunc(index) || 0), Math.max(0, length - 1));

/** The first position of each decade (for the progress bar's "jump to" buttons). */
export function decadeStarts(positions: RosaryPosition[]): number[] {
  return [1, 2, 3, 4, 5].map((d) => positions.findIndex((p) => p.decade === d));
}

export type SavedProgress = { set: string; index: number; savedAt: number };

/** Parses saved progress; ignores anything malformed or older than a day. */
export function parseProgress(raw: string | null, now = Date.now()): SavedProgress | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SavedProgress>;
    if (typeof value.set !== "string" || typeof value.index !== "number" || typeof value.savedAt !== "number")
      return null;
    if (now - value.savedAt > 24 * 60 * 60 * 1000) return null;
    return { set: value.set, index: value.index, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export type MysterySetKey = "joyful" | "luminous" | "sorrowful" | "glorious";

/**
 * The mysteries for a day: by weekday (ISO 1 = Monday), except Sundays of Advent and
 * Christmas Time (Joyful) and of Lent (Sorrowful), as suggested in Rosarium Virginis Mariae 38.
 */
export function mysteriesFor(
  isoWeekday: number,
  season: string,
  sets: { key: MysterySetKey; weekdays: number[] }[],
): MysterySetKey {
  if (isoWeekday === 7 && (season === "advent" || season === "christmas")) return "joyful";
  if (isoWeekday === 7 && season === "lent") return "sorrowful";
  return sets.find((s) => s.weekdays.includes(isoWeekday))?.key ?? "joyful";
}
