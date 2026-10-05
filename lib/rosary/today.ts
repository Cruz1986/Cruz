import { liturgicalDay } from "@/lib/liturgy";
import { parseIsoDate, todayIn, weekday } from "@/lib/liturgy/plain-date";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { mysteriesFor, type MysterySetKey } from "./sequence";

/** Today's mysteries for India's date (the calendar engine supplies the season). */
export function todaysMysteries(sets: { key: MysterySetKey; weekdays: number[] }[], isoDate?: string): MysterySetKey {
  const date = (isoDate && parseIsoDate(isoDate)) || todayIn(DEFAULT_TIME_ZONE);
  const iso = weekday(date) === 0 ? 7 : weekday(date);
  return mysteriesFor(iso, liturgicalDay(date, "in").season, sets);
}
