/** Calendar dates without time zones (UTC arithmetic only). */

export type PlainDate = { year: number; month: number; day: number };

const DAY = 86_400_000;

export function plainDate(year: number, month: number, day: number): PlainDate {
  const d = new Date(Date.UTC(year, month - 1, day));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function parseIsoDate(value: string): PlainDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = plainDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return toIso(date) === value ? date : null;
}

export function toIso({ year, month, day }: PlainDate): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toTime({ year, month, day }: PlainDate): number {
  return Date.UTC(year, month - 1, day);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  const d = new Date(toTime(date) + days * DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: PlainDate): number {
  return new Date(toTime(date)).getUTCDay();
}

export function diffDays(a: PlainDate, b: PlainDate): number {
  return Math.round((toTime(b) - toTime(a)) / DAY);
}

export function compare(a: PlainDate, b: PlainDate): number {
  return toTime(a) - toTime(b);
}

export const sameDate = (a: PlainDate, b: PlainDate) => compare(a, b) === 0;

/** The first given weekday strictly after `date` (PHP "next <weekday>"). */
export function nextWeekday(date: PlainDate, wd: number): PlainDate {
  const delta = (wd - weekday(date) + 7) % 7 || 7;
  return addDays(date, delta);
}

/** The last given weekday strictly before `date` (PHP "last <weekday>"). */
export function previousWeekday(date: PlainDate, wd: number): PlainDate {
  const delta = (weekday(date) - wd + 7) % 7 || 7;
  return addDays(date, -delta);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's date in an IANA time zone. */
export function todayIn(timeZone: string, now = new Date()): PlainDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parseIsoDate(parts) ?? plainDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}
