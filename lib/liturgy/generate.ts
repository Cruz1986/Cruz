/**
 * Roman Catholic liturgical calendar for one civil year.
 *
 * A TypeScript port of Roman-Calendar v5 (github.com/jayarathina/Roman-Calendar, Unlicense),
 * kept deliberately close to the original so its published yearly output can be used as a
 * test oracle (tests/fixtures/roman-calendar). Day codes follow the original:
 * `<season><week>-<weekday number><weekday>` for ferial days, e.g. OW04-0Sun, LW03-4Thu.
 */
import { FIXED_FEASTS, type FixedFeast } from "./data/fixed-feasts";
import { easterSunday } from "./easter";
import { rankOf } from "./ranks";
import {
  addDays,
  compare,
  daysInMonth,
  diffDays,
  nextWeekday,
  plainDate,
  previousWeekday,
  sameDate,
  weekday,
  type PlainDate,
} from "./plain-date";
import type { LiturgicalColor } from "@/lib/design/liturgical-colors";

export type CalendarOptions = {
  /** Epiphany on the Sunday between 2 and 8 January (e.g. India) instead of 6 January. */
  epiphanyOnSunday: boolean;
  ascensionOnSunday: boolean;
  corpusChristiOnSunday: boolean;
  /** Include the proper calendar of India (feasts coded "IN …"). */
  india: boolean;
};

export type CalendarEntry = { code: string; rank: number; type?: string; color: LiturgicalColor };

export type CalendarDay = {
  date: PlainDate;
  /** entries[0] is the day itself; further entries are memorials that may be kept. */
  entries: CalendarEntry[];
  /** Celebrations impeded this year (kept for information). */
  suppressed: CalendarEntry[];
};

type Entry = { code: string; rank: number; type?: string };
type Day = { entries: Entry[]; other: Entry[] };

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type SeasonLimits = {
  advent: PlainDate;
  christmas: PlainDate;
  epiphany: PlainDate;
  baptism: PlainDate;
  ordinaryTime1: PlainDate;
  lent: PlainDate;
  easter: PlainDate;
  ordinaryTime2: PlainDate;
};

export function seasonLimits(year: number, epiphanyOnSunday: boolean): SeasonLimits {
  let epiphany = plainDate(year, 1, 6);
  let baptism = nextWeekday(epiphany, 0);
  if (epiphanyOnSunday) {
    epiphany = nextWeekday(plainDate(year, 1, 1), 0);
    baptism = epiphany.day > 6 ? addDays(epiphany, 1) : nextWeekday(epiphany, 0);
  }
  const easter = easterSunday(year);
  return {
    advent: nextWeekday(plainDate(year, 11, 26), 0),
    christmas: plainDate(year, 12, 25),
    epiphany,
    baptism,
    ordinaryTime1: addDays(baptism, 1),
    lent: addDays(easter, -46),
    easter,
    ordinaryTime2: addDays(easter, 50),
  };
}

function typeForRank(code: string, rank: number): string | undefined {
  if (code === "EW01-0Sun") return "Solemnity";
  if ([2, 2.4, 3.1, 4.1, 4.2, 4.3].includes(rank)) return "Solemnity";
  if (rank === 5) return "Feast-Lord";
  if (rank === 7) return "Feast";
  return undefined;
}

class YearBuilder {
  readonly days = new Map<string, Day>();

  constructor(readonly year: number) {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= daysInMonth(year, month); day++)
        this.days.set(`${month}-${day}`, { entries: [], other: [] });
    }
  }

  day(date: PlainDate): Day {
    // Dates outside the year (never expected) get a throwaway day.
    return this.days.get(`${date.month}-${date.day}`) ?? { entries: [], other: [] };
  }

  setDayCode(date: PlainDate, code: string) {
    const rank = rankOf(code);
    const type = typeForRank(code, rank);
    this.day(date).entries[0] = type ? { code, rank, type } : { code, rank };
  }

  fillInWeek(start: PlainDate, end: PlainDate, prefix: string, week = 0) {
    for (let d = start; compare(d, end) < 0; d = addDays(d, 1)) {
      const wd = weekday(d);
      if (wd === 0) week++;
      this.setDayCode(d, `${prefix}${String(week).padStart(2, "0")}-${wd}${WEEKDAY_ABBR[wd]}`);
    }
  }

  /** Puts `entry` as the day and moves everything that was there to the impeded list. */
  pushDayCode(date: PlainDate, entry: Entry) {
    const day = this.day(date);
    const previous = [...day.entries, ...day.other];
    day.entries = [entry];
    day.other = [];
    this.addOther(date, previous);
  }

  addOther(date: PlainDate, entries: Entry[]) {
    if (entries.length === 0) return;
    // Christmas octave days are never listed as impeded.
    if (entries[0].code.startsWith("CW01-")) return;
    this.day(date).other.push(...entries);
  }
}

function movable(builder: YearBuilder, limits: SeasonLimits, options: CalendarOptions) {
  const { year } = builder;

  // Advent, then 17–24 December as weekdays of the final week
  builder.fillInWeek(limits.advent, limits.christmas, "AW");
  for (let d = plainDate(year, 12, 17); compare(d, limits.christmas) < 0; d = addDays(d, 1)) {
    if (weekday(d) !== 0) builder.setDayCode(d, `AW04-${MONTH_ABBR[d.month]}${d.day}`);
  }

  // Christmas octave (26–31 December) and the Holy Family
  for (let i = 1; i < 7; i++) {
    const d = addDays(limits.christmas, i);
    builder.setDayCode(d, `CW01-${MONTH_ABBR[d.month]}${d.day}`);
  }
  const holyFamily =
    weekday(limits.christmas) === 0 ? nextWeekday(limits.christmas, 5) : nextWeekday(limits.christmas, 0);
  builder.setDayCode(holyFamily, "CW01-HolyFamily");

  // January: before Epiphany, Epiphany, after Epiphany, Baptism
  builder.setDayCode(limits.epiphany, "CW03-Epiphany");
  builder.setDayCode(limits.baptism, "CW04-Baptism");
  for (let i = 1; ; i++) {
    const d = addDays(plainDate(year, 1, 1), i);
    if (sameDate(d, limits.epiphany)) break;
    builder.setDayCode(d, weekday(d) === 0 ? "CW02-0Sun" : `CW02-${MONTH_ABBR[d.month]}${d.day}`);
  }
  for (let i = 1; ; i++) {
    const d = addDays(limits.epiphany, i);
    if (sameDate(d, limits.baptism)) break;
    builder.setDayCode(d, `CW03-Day${i}`);
  }

  // Lent (Ash Wednesday is week 0)
  builder.fillInWeek(limits.lent, limits.easter, "LW");

  // Easter season, Ascension, Pentecost
  builder.fillInWeek(limits.easter, limits.ordinaryTime2, "EW");
  builder.setDayCode(addDays(limits.easter, options.ascensionOnSunday ? 42 : 39), "EW07-Ascension");
  builder.setDayCode(addDays(limits.easter, 49), "EW08-Pentecost");

  // Ordinary Time before Lent
  builder.fillInWeek(limits.ordinaryTime1, limits.lent, "OW", 1);

  // Ordinary Time after Pentecost: count back from Christ the King (week 34)
  const trinity = nextWeekday(limits.ordinaryTime2, 0);
  const christTheKing = previousWeekday(limits.advent, 0);
  const firstWeek = 33 - diffDays(trinity, christTheKing) / 7;
  builder.fillInWeek(limits.ordinaryTime2, limits.advent, "OW", firstWeek);
  builder.setDayCode(trinity, "OW00-Trinity");
  let corpusChristi = nextWeekday(trinity, 4);
  if (options.corpusChristiOnSunday) corpusChristi = nextWeekday(corpusChristi, 0);
  builder.setDayCode(corpusChristi, "OW00-CorpusChristi");
  builder.setDayCode(addDays(nextWeekday(trinity, 0), 5), "OW00-SacredHeart");
}

function feastsOfYear(year: number, options: CalendarOptions, filter: (type: string) => boolean): FixedFeast[] {
  return FIXED_FEASTS.filter(
    (f) =>
      filter(f.type) &&
      (options.india || !f.code.startsWith("IN ")) &&
      !(f.added !== undefined && f.added > year) &&
      !(f.removed !== undefined && year >= f.removed),
  );
}

function fixed(builder: YearBuilder, options: CalendarOptions) {
  const { year } = builder;

  // Solemnities (with transfers when impeded)
  for (const feast of feastsOfYear(year, options, (t) => t.startsWith("Solemnity"))) {
    const type = feast.month === 11 && feast.day === 2 ? "All Souls" : feast.type;
    const rank = rankOf(type);
    let date = plainDate(year, feast.month, feast.day);
    const current = builder.day(date).entries[0];
    const currentRank = current ? current.rank : 50;

    if (!(rank < currentRank)) {
      if (feast.month === 3 && feast.day === 19 && current?.code.startsWith("LW06")) {
        // St Joseph in Holy Week moves to the Saturday before Palm Sunday.
        date = previousWeekday(date, 6);
      } else if (
        feast.code === "Birth of Saint John the Baptist" &&
        current?.code === "OW00-SacredHeart" &&
        year === 2022
      ) {
        // Ad hoc decision of the Dicastery for 2022.
        date = addDays(date, -1);
      } else {
        // Otherwise to the nearest following day that does not outrank it.
        do {
          date = addDays(date, 1);
        } while (rank > (builder.day(date).entries[0]?.rank ?? 50));
      }
    }
    builder.pushDayCode(date, { code: feast.code, rank, type });
  }

  // Feasts (omitted when impeded)
  for (const feast of feastsOfYear(year, options, (t) => t.startsWith("Feast"))) {
    const date = plainDate(year, feast.month, feast.day);
    const entry = { code: feast.code, rank: rankOf(feast.type), type: feast.type };
    if (entry.rank < builder.day(date).entries[0].rank) builder.pushDayCode(date, entry);
    else builder.addOther(date, [entry]);
  }

  // Memorials and optional memorials
  const easter = easterSunday(year);
  const memorials: { date: PlainDate; code: string; type: string }[] = feastsOfYear(year, options, (t) =>
    /^(Mem|OpMem)/.test(t),
  ).map((f) => ({ date: plainDate(year, f.month, f.day), code: f.code, type: f.type }));
  memorials.push({ date: addDays(easter, 69), code: "OW00-ImmaculateHeart", type: "Mem-Mary" });
  if (year >= 2018) memorials.push({ date: addDays(easter, 50), code: "OW00-MaryMotherofChurch", type: "Mem-Mary" });
  addMemorials(builder, memorials);

  // Saturday memorial of the Blessed Virgin Mary on free Saturdays in Ordinary Time (GILH 240)
  const saturdays: typeof memorials = [];
  for (let d = nextWeekday(plainDate(year, 1, 1), 6); d.year === year; d = addDays(d, 7)) {
    const day = builder.day(d);
    if (day.entries[0]?.rank !== rankOf("OW")) continue;
    if ((day.entries[1]?.rank ?? 15) <= rankOf("OpMem")) continue;
    saturdays.push({ date: d, code: "Mem-Mary-Sat", type: "Mem-Mary-Sat" });
  }
  addMemorials(builder, saturdays);
}

function addMemorials(builder: YearBuilder, memorials: { date: PlainDate; code: string; type: string }[]) {
  for (const memorial of memorials) {
    const day = builder.day(memorial.date);
    const entry: Entry = { code: memorial.code, rank: rankOf(memorial.type), type: memorial.type };
    const other: Entry[] = [];

    // A memorial of Our Lady prevails over another obligatory memorial…
    if (day.entries[1] && day.entries[1].rank === 10.2 && entry.rank === 10.1) {
      if (entry.code === "OW00-ImmaculateHeart") {
        // …except the Immaculate Heart: then both become optional (Dicastery, 2000).
        day.entries[1] = { ...day.entries[1], type: "OpMem", rank: rankOf("OpMem") };
        entry.type = "OpMem";
        entry.rank = rankOf("OpMem");
      } else {
        other.push(day.entries[1]);
        day.entries.splice(1, 1);
      }
    }

    for (let i = day.entries.length - 1; i >= 1; i--) {
      if (entry.rank < day.entries[i].rank) {
        other.unshift(day.entries[i]);
        day.entries.splice(i, 1);
      }
    }

    if (entry.rank < day.entries[0].rank) {
      day.entries.push(entry);
    } else if (Math.trunc(day.entries[0].rank) === 9) {
      // Privileged weekdays (17–24 Dec, Christmas octave, Lent): memorials become commemorations.
      day.entries.push({ ...entry, type: "OpMem-Commemoration", rank: rankOf("OpMem-Commemoration") });
    } else {
      other.push(entry);
    }
    builder.addOther(memorial.date, other);
  }
}

const COLORS: Record<string, LiturgicalColor> = {
  Solemnity: "white",
  "Saints Peter and Paul, Apostles": "red",
  "EW08-Pentecost": "red",
  "AW03-0Sun": "rose",
  "LW04-0Sun": "rose",
  "Feast-Lord": "white",
  "Exaltation of the Holy Cross": "red",
  Feast: "white",
  Mem: "white",
  OpMem: "white",
  martyr: "red",
  "Chair of Saint Peter, apostle": "white",
  "The Conversion of Saint Paul, apostle": "white",
  "Saint John the Apostle and evangelist": "white",
  "LW06-0Sun": "red",
  "LW06-4Thu": "white",
  "LW06-5Fri": "red",
  "LW06-6Sat": "white",
  "All Souls": "violet",
};

export function colorOf(code: string, type?: string): LiturgicalColor {
  const typeKey = (type ?? "").split("-")[0];
  let color: LiturgicalColor | undefined = COLORS[code] ?? COLORS[typeKey];
  if (!color) {
    const prefix = code.slice(0, 2);
    color = prefix === "AW" || prefix === "LW" ? "violet" : prefix === "OW" ? "green" : "white";
  }
  if (!(code in COLORS)) {
    const lower = code.toLowerCase();
    if (lower.includes("martyr") || lower.includes("apostle") || lower.includes("evangelist")) color = "red";
  }
  return color;
}

export function generateYear(year: number, options: CalendarOptions): CalendarDay[] {
  const builder = new YearBuilder(year);
  const limits = seasonLimits(year, options.epiphanyOnSunday);
  movable(builder, limits, options);
  fixed(builder, options);

  const result: CalendarDay[] = [];
  for (const [key, day] of builder.days) {
    const [month, dayOfMonth] = key.split("-").map(Number);
    const entries = day.entries.map((e) => ({ ...e, color: colorOf(e.code, e.type) }));
    // The day takes the colour of an obligatory memorial kept on it.
    const memorial = entries[1];
    if (memorial?.type?.startsWith("Mem") && memorial.type !== "Mem-Mary-Sat")
      entries[0] = { ...entries[0], color: memorial.color };
    result.push({
      date: plainDate(year, month, dayOfMonth),
      entries,
      suppressed: day.other.map((e) => ({ ...e, color: colorOf(e.code, e.type) })),
    });
  }
  return result;
}
