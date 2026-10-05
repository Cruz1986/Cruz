/** What a reminder says (pure; unit tested). */
import type { Season } from "@/lib/liturgy";

export type ReminderParts = { dailyReading: boolean; saintOfDay: boolean; prayer: boolean; rosary: boolean };
export type Named = { en: string; ta: string };
export type DayInfo = {
  title: Named | null;
  season: Season | null;
  /** Gospel reference, already in each language's form. */
  gospel: Named | null;
  saints: Named[];
  rosary: Named | null;
};
export type ReminderLabels = { today: string; gospel: string; saint: string; rosary: string; prayer: string };
export type PushPayload = { title: string; body: string; url: string; tag: string };

export const SUGGESTED_PRAYERS = {
  morning: { slug: "morning-offering", name: { en: "Morning Offering", ta: "காலை ஒப்புக்கொடுத்தல்" } },
  angelus: { slug: "angelus", name: { en: "The Angelus", ta: "மூவேளைச் செபம்" } },
  reginaCaeli: { slug: "regina-caeli", name: { en: "Regina Caeli", ta: "விண்ணக அரசியே" } },
  afternoon: { slug: "memorare", name: { en: "Memorare", ta: "நினைவுகூரும் செபம்" } },
  evening: { slug: "act-of-contrition", name: { en: "Act of Contrition", ta: "மனத்துயர் செபம்" } },
} as const;

/** A prayer that suits the hour: the Morning Offering, the Angelus at midday (Regina Caeli in Easter Time), … */
export function prayerFor(hour: number, season: Season | null) {
  if (hour < 11) return SUGGESTED_PRAYERS.morning;
  if (hour < 15) return season === "easter" ? SUGGESTED_PRAYERS.reginaCaeli : SUGGESTED_PRAYERS.angelus;
  if (hour < 18) return SUGGESTED_PRAYERS.afternoon;
  return SUGGESTED_PRAYERS.evening;
}

/** One notification for the day with the parts the reader chose, in their language. */
export function composeReminder({
  parts,
  day,
  locale,
  localDate,
  localHour,
  labels,
}: {
  parts: ReminderParts;
  day: DayInfo;
  locale: "ta" | "en";
  localDate: string;
  localHour: number;
  labels: ReminderLabels;
}): PushPayload {
  const pick = (n: Named) => n[locale] || n.en;
  const lines: string[] = [];
  if (parts.dailyReading && day.gospel) lines.push(`${labels.gospel}: ${pick(day.gospel)}`);
  if (parts.saintOfDay && day.saints.length)
    lines.push(`${labels.saint}: ${day.saints.slice(0, 2).map(pick).join(", ")}`);
  if (parts.rosary && day.rosary) lines.push(`${labels.rosary}: ${pick(day.rosary)}`);
  const prayer = parts.prayer ? prayerFor(localHour, day.season) : null;
  if (prayer) lines.push(`${labels.prayer}: ${pick(prayer.name)}`);

  const path = parts.dailyReading
    ? `/today/${localDate}`
    : parts.saintOfDay
      ? "/saints"
      : parts.rosary
        ? "/rosary"
        : `/prayers/${prayer?.slug ?? ""}`;
  return {
    title: day.title ? pick(day.title) : labels.today,
    body: lines.join("\n").slice(0, 400),
    url: `/${locale}${path}`,
    tag: `daily-${localDate}`,
  };
}
