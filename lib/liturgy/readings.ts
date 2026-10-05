/**
 * Assembles the readings of a day's Masses from lectionary sets (pure; tested).
 *
 * Rules (from the Tamil Lectionary's own logic):
 *  - A Mass's base sets are merged (e.g. "OW05-0Sun" holds the acclamation, "OW05-0Sun A" the rest).
 *  - Alternatives (alt groups) and shorter forms are offered as options of one slot.
 *  - A memorial's *proper* readings replace the weekday reading of the same kind; when the
 *    Gospel is replaced, the acclamation follows it.
 *  - Feasts on weekdays have one reading before the Gospel: the first and second readings
 *    become alternatives.
 *  - The Easter Vigil's readings are numbered: first reading 1, psalm 1, first reading 2, …
 */
import type { ReadingType, VerseRange } from "./lectionary";

export type LectionaryReading = {
  type: ReadingType;
  sequence: number;
  altGroup: number;
  isShort: boolean;
  isProper: boolean;
  sourceType: string;
  reference: string;
  ranges: VerseRange[];
};

export type MassSet = {
  massKey: "vigil" | "night" | "dawn" | "day" | "chrism";
  role: "base" | "memorial";
  celebrationCode: string | null;
  setCode: string;
  readings: LectionaryReading[];
};

export type ReadingSlot = { type: ReadingType; sequence: number; options: LectionaryReading[] };
export type Mass = { key: MassSet["massKey"]; slots: ReadingSlot[] };
export type MemorialReadings = { celebrationCode: string; slots: ReadingSlot[]; commons: string[] };

const ORDER: Record<ReadingType, number> = {
  procession_gospel: 0,
  first: 1,
  psalm: 2,
  second: 3,
  sequence: 4,
  acclamation: 5,
  gospel: 6,
  commons: 9,
};
const MASS_ORDER = ["vigil", "night", "dawn", "day", "chrism"] as const;

function slotKey(r: LectionaryReading) {
  return `${r.type}:${r.sequence}`;
}

function sortOptions(a: LectionaryReading, b: LectionaryReading) {
  return a.altGroup - b.altGroup || Number(a.isShort) - Number(b.isShort) || a.sourceType.localeCompare(b.sourceType);
}

/** Groups readings into slots in liturgical order (the Easter Vigil interleaves readings and psalms). */
export function toSlots(readings: LectionaryReading[]): ReadingSlot[] {
  const slots = new Map<string, ReadingSlot>();
  for (const r of readings) {
    if (r.type === "commons") continue;
    const key = slotKey(r);
    const slot = slots.get(key) ?? { type: r.type, sequence: r.sequence, options: [] };
    slot.options.push(r);
    slots.set(key, slot);
  }
  const position = (s: ReadingSlot) => {
    const interleaved = s.type === "first" || s.type === "psalm" || s.type === "second";
    return (interleaved ? s.sequence : 99) * 10 + ORDER[s.type];
  };
  return [...slots.values()]
    .map((s) => ({ ...s, options: s.options.sort(sortOptions) }))
    .sort((a, b) =>
      a.type === "procession_gospel" ? -1 : b.type === "procession_gospel" ? 1 : position(a) - position(b),
    );
}

export function assembleMasses(
  sets: MassSet[],
  { weekdayFeast }: { weekdayFeast: boolean },
): { masses: Mass[]; memorials: MemorialReadings[] } {
  const memorialSets = sets.filter((s) => s.role === "memorial");
  const proper = memorialSets.flatMap((s) => s.readings.filter((r) => r.isProper));

  const masses: Mass[] = [];
  for (const key of MASS_ORDER) {
    const base = sets.filter((s) => s.role === "base" && s.massKey === key).flatMap((s) => s.readings);
    if (base.length === 0) continue;
    let readings = base;

    if (key === "day" && proper.length) {
      const replaced = new Set(proper.map((r) => r.type));
      if (replaced.has("gospel")) {
        const acclamation = memorialSets.flatMap((s) => s.readings).filter((r) => r.type === "acclamation");
        if (acclamation.length) {
          replaced.add("acclamation");
          proper.push(...acclamation);
        }
      }
      readings = [...readings.filter((r) => !replaced.has(r.type)), ...proper];
    }

    let slots = toSlots(readings);
    if (weekdayFeast) {
      const first = slots.find((s) => s.type === "first");
      const second = slots.find((s) => s.type === "second");
      if (first && second) {
        first.options.push(...second.options);
        slots = slots.filter((s) => s !== second);
      }
    }
    masses.push({ key, slots });
  }

  const memorials: MemorialReadings[] = memorialSets.map((s) => ({
    celebrationCode: s.celebrationCode ?? s.setCode,
    slots: toSlots(s.readings.filter((r) => !r.isProper)),
    commons: s.readings.filter((r) => r.type === "commons").flatMap((r) => r.reference.split(/\s+or\s+/)),
  }));

  return { masses, memorials };
}

/** Canonical verse-key ranges (see bible_verses.canonical_vkey) for passage lookup. */
export function vkeyRanges(ranges: VerseRange[], canonOrder: ReadonlyMap<string, number>): [number, number][] {
  return ranges.flatMap((r) => {
    const order = canonOrder.get(r.book);
    if (!order) return [];
    const key = (c: number, v: number) => order * 1_000_000 + c * 1000 + v;
    return [[key(r.startChapter, r.startVerse), key(r.endChapter, Math.min(r.endVerse, 999))] as [number, number]];
  });
}

/** "Isa 58:7-10", "Ps 112:4-5, 6-7, 8a, 9", "1 Chr 15:3-4, 15-16; 16:1-2", "2 Chr 5:13 – 6:2". */
export function formatRanges(ranges: VerseRange[], bookAbbr: (code: string) => string): string {
  if (ranges.length === 0) return "";
  const parts: string[] = [];
  let chapter: number | null = null;
  let chunk = "";
  for (const r of ranges) {
    const start = `${r.startVerse}${r.startPart}`;
    const end =
      r.endChapter !== r.startChapter ? `${r.endChapter}:${r.endVerse}${r.endPart}` : `${r.endVerse}${r.endPart}`;
    const item =
      start === end && r.endChapter === r.startChapter
        ? start
        : r.endChapter !== r.startChapter
          ? `${start} – ${end}`
          : `${start}-${end}`;
    if (chapter === r.startChapter) chunk += `, ${item}`;
    else {
      if (chunk) parts.push(chunk);
      chunk = `${r.startChapter}:${item}`;
    }
    chapter = r.endChapter;
  }
  parts.push(chunk);
  return `${bookAbbr(ranges[0].book)} ${parts.join("; ")}`;
}

/** Sequence hymns are referenced by name in the lectionary data. */
export const SEQUENCE_NAMES: Readonly<Record<string, string>> = {
  Victimae: "Victimae paschali laudes",
  VeniSancteSpiritus: "Veni, Sancte Spiritus",
  LaudaSion: "Lauda Sion",
  StabatMater: "Stabat Mater",
};

/** What to show as a reading's reference, or null for internal pointers ("AW01-1Mon", "LW06-6Sat~1"). */
export function displayableReference(option: LectionaryReading): string | null {
  if (option.ranges.length) return option.reference;
  if (SEQUENCE_NAMES[option.reference]) return SEQUENCE_NAMES[option.reference];
  return !/^[A-Z]{2}\d{2}-|~\d|^_/.test(option.reference) && /\d/.test(option.reference) ? option.reference : null;
}

/** Drops readings that have nothing to show, and slots left empty. */
export function visibleSlots(slots: ReadingSlot[]): ReadingSlot[] {
  return slots
    .map((s) => ({ ...s, options: s.options.filter((o) => displayableReference(o) !== null) }))
    .filter((s) => s.options.length > 0);
}
