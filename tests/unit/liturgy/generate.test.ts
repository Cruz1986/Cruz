import { describe, expect, it } from "vitest";
import { easterSunday } from "@/lib/liturgy/easter";
import { generateYear, seasonLimits, type CalendarOptions } from "@/lib/liturgy/generate";
import { toIso } from "@/lib/liturgy/plain-date";
import y2026 from "../../fixtures/roman-calendar/2026-in.json";
import y2027 from "../../fixtures/roman-calendar/2027-in.json";

const INDIA: CalendarOptions = {
  epiphanyOnSunday: true,
  ascensionOnSunday: true,
  corpusChristiOnSunday: true,
  india: true,
};

type OracleEntry = { code: string; rank: number; type?: string; color: string };
type OracleDay = OracleEntry[] | Record<string, OracleEntry | OracleEntry[]>;

/** Normalises the PHP output (lists or objects with an "other" key; "purple" = violet). */
function oracleDay(raw: OracleDay) {
  const values = Array.isArray(raw)
    ? raw
    : Object.entries(raw)
        .filter(([k]) => k !== "other")
        .map(([, v]) => v as OracleEntry);
  const other = Array.isArray(raw) ? [] : ((raw.other as OracleEntry[] | undefined) ?? []);
  const norm = (e: OracleEntry) => ({
    code: e.code,
    rank: e.rank,
    type: e.type,
    color: e.color === "purple" ? "violet" : e.color,
  });
  return { entries: values.map(norm), suppressed: other.map(norm) };
}

function compareYear(year: number, oracle: Record<string, Record<string, OracleDay>>) {
  const days = generateYear(year, INDIA);
  const mismatches: string[] = [];
  for (const day of days) {
    const expected = oracleDay(oracle[day.date.month][day.date.day]);
    const actual = {
      entries: day.entries.map((e) => ({ code: e.code, rank: e.rank, type: e.type, color: e.color })),
      suppressed: day.suppressed.map((e) => ({ code: e.code, rank: e.rank, type: e.type, color: e.color })),
    };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      mismatches.push(
        `${toIso(day.date)}\n  got      ${JSON.stringify(actual)}\n  expected ${JSON.stringify(expected)}`,
      );
    }
  }
  return mismatches;
}

describe("Easter", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2038, "2038-04-25"],
    [2285, "2285-03-22"],
  ])("Easter %i is %s", (year, iso) => {
    expect(toIso(easterSunday(year))).toBe(iso);
  });
});

describe("season limits", () => {
  it("places Epiphany on the Sunday in India and Baptism the next day when Epiphany is 7 or 8 January", () => {
    const l = seasonLimits(2023, true);
    expect(toIso(l.epiphany)).toBe("2023-01-08");
    expect(toIso(l.baptism)).toBe("2023-01-09");
    expect(toIso(seasonLimits(2026, false).epiphany)).toBe("2026-01-06");
  });
});

describe("matches the Roman-Calendar reference output (India)", () => {
  it("2026", () => {
    expect(compareYear(2026, y2026 as never)).toEqual([]);
  });
  it("2027", () => {
    expect(compareYear(2027, y2027 as never)).toEqual([]);
  });
});

import { cycles, liturgicalDay } from "@/lib/liturgy";
import { parseIsoDate } from "@/lib/liturgy/plain-date";
import { dayTitle } from "@/lib/liturgy/titles";

const day = (iso: string, calendar: "gr" | "in" = "gr") => liturgicalDay(parseIsoDate(iso)!, calendar);

describe("known liturgical dates", () => {
  it.each([
    ["2026-02-18", "LW00-3Wed"],
    ["2026-04-05", "EW01-0Sun"],
    ["2026-05-14", "EW07-Ascension"],
    ["2026-05-24", "EW08-Pentecost"],
    ["2026-11-22", "OW34-0Sun"],
    ["2026-11-29", "AW01-0Sun"],
    ["2024-04-08", "Annunciation of the Lord"], // 25 March 2024 fell in Holy Week
    ["2024-12-09", "Immaculate Conception of the Blessed Virgin Mary"], // 8 December 2024 was a Sunday of Advent
    ["2026-12-25", "Nativity of the Lord"],
  ])("General Roman Calendar: %s is %s", (iso, code) => {
    expect(day(iso).celebrations[0].code).toBe(code);
  });

  it("transfers Ascension to Sunday in India", () => {
    expect(day("2027-05-09", "in").celebrations[0].code).toBe("EW07-Ascension");
    expect(day("2027-05-06", "in").celebrations[0].code).toBe("EW06-4Thu");
    expect(day("2027-05-06", "gr").celebrations[0].code).toBe("EW07-Ascension");
  });

  it("keeps India's proper celebrations out of the general calendar", () => {
    expect(day("2026-07-03", "in").celebrations[0].code).toBe("IN Saint Thomas the Apostle");
    expect(day("2026-07-03", "gr").celebrations[0].code).toBe("Saint Thomas the Apostle");
    expect(day("2026-07-03", "gr").celebrations[0].type).toBe("Feast");
  });

  it("reports season, week and colour", () => {
    const ashWednesday = day("2026-02-18");
    expect([ashWednesday.season, ashWednesday.week, ashWednesday.color]).toEqual(["lent", 0, "violet"]);
    expect(day("2026-04-03").season).toBe("triduum");
    expect(day("2026-07-15").season).toBe("ordinary");
    expect(day("2026-12-13").color).toBe("rose");
  });

  it("keeps the weekday code under a feast", () => {
    expect(day("2026-03-19").ferialCode).toBe("LW04-4Thu");
  });
});

describe("lectionary cycles", () => {
  it.each([
    ["2026-06-01", "A", "II"],
    ["2026-11-29", "B", "I"],
    ["2027-06-01", "B", "I"],
    ["2028-06-01", "C", "II"],
  ])("%s is Sunday cycle %s, weekday cycle %s", (iso, sunday, weekday) => {
    expect(
      cycles(parseIsoDate(iso)!, {
        epiphanyOnSunday: false,
        ascensionOnSunday: false,
        corpusChristiOnSunday: false,
        india: false,
      }),
    ).toEqual({
      sundayCycle: sunday,
      weekdayCycle: weekday,
    });
  });
});

describe("titles", () => {
  it("names weekdays in English and Tamil", () => {
    expect(dayTitle("OW05-1Mon", false)).toEqual({
      en: "Monday of the 5th Week in Ordinary Time",
      ta: "பொதுக்காலம் 5ஆம் வாரம் - திங்கள்",
    });
    expect(dayTitle("LW01-0Sun", false).ta).toBe("தவக்காலம் முதல் வாரம் - ஞாயிறு");
    expect(dayTitle("AW04-Dec17", false).en).toBe("Advent Weekday: December 17");
    expect(dayTitle("IN Saint Francis Xavier, priest", false).en).toBe("Saint Francis Xavier, priest");
  });
});
