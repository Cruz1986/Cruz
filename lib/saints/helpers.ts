/** Pure helpers for saints: feast dates, life spans, search and the saints of a day (unit tested). */
import { normalizeText } from "@/lib/bible/text";
import { daysInMonth, type PlainDate } from "@/lib/liturgy/plain-date";

export type SaintSummary = {
  slug: string;
  nameEn: string;
  nameTa: string;
  titleEn: string | null;
  titleTa: string | null;
  feastMonth: number | null;
  feastDay: number | null;
  patronageEn: string | null;
  patronageTa: string | null;
};

/** The next date (today included) a fixed feast falls on; 29 February waits for a leap year. */
export function nextFeastDate(month: number, day: number, today: PlainDate): PlainDate {
  for (let year = today.year; year < today.year + 9; year++) {
    if (day > daysInMonth(year, month)) continue;
    const date = { year, month, day };
    if (year > today.year || month > today.month || (month === today.month && day >= today.day)) return date;
  }
  throw new Error(`No date for ${month}-${day}`);
}

/** "1506–1552", "† 1552", "b. 1256" or null. */
export function lifeSpan(born: number | null, died: number | null): string | null {
  if (born && died) return `${born}–${died}`;
  if (died) return `† ${died}`;
  if (born) return `b. ${born}`;
  return null;
}

/** Saints matching a query, best matches first: name, then titles and patronage. */
export function searchSaints<T extends SaintSummary>(saints: T[], query: string): T[] {
  const q = normalizeText(query);
  if (!q) return saints;
  const score = (s: T) => {
    if (normalizeText(`${s.nameEn} ${s.nameTa}`).includes(q)) return 2;
    const rest = `${s.titleEn ?? ""} ${s.titleTa ?? ""} ${s.patronageEn ?? ""} ${s.patronageTa ?? ""}`;
    return normalizeText(rest).includes(q) ? 1 : 0;
  };
  return saints
    .map((s, i) => ({ s, i, score: score(s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.s);
}

/**
 * The saints of a day: those whose celebration the calendar keeps that day (in the calendar's order),
 * then any others whose feast falls on that date.
 */
export function saintsOfDay<T extends SaintSummary & { id: string }>(
  date: PlainDate,
  celebrated: string[],
  saints: T[],
): T[] {
  const byId = new Map(saints.map((s) => [s.id, s]));
  const result: T[] = [];
  for (const id of celebrated) {
    const saint = byId.get(id);
    if (saint && !result.includes(saint)) result.push(saint);
  }
  for (const saint of saints)
    if (saint.feastMonth === date.month && saint.feastDay === date.day && !result.includes(saint)) result.push(saint);
  return result;
}

export function saintName(s: Pick<SaintSummary, "nameEn" | "nameTa">, locale: string): string {
  return locale === "ta" ? s.nameTa : s.nameEn;
}

export function saintTitle(s: Pick<SaintSummary, "titleEn" | "titleTa">, locale: string): string | null {
  return locale === "ta" ? (s.titleTa ?? null) : (s.titleEn ?? null);
}

/** "3 December" / "3 டிசம்பர்". */
export function feastLabel(month: number | null, day: number | null, locale: string): string | null {
  if (!month || !day) return null;
  return new Intl.DateTimeFormat(`${locale}-IN`, { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, day)),
  );
}

export function monthNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(`${locale}-IN`, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2000, i, 1))));
}

/** The first sentence of a biography, shortened to about `max` characters. */
export function excerpt(text: string, max = 180): string {
  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max)}…`;
}
