import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import type { TodayWithText } from "@/lib/content/today";
import { allBooks, publicBible } from "@/lib/content/public-bible";
import { publicReflections } from "@/lib/content/reflections";
import { visibleSlots } from "@/lib/liturgy/readings";
import { EmptyState } from "@/components/ui/empty-state";
import { DayHeader } from "./day-header";
import { ReadingCard } from "./reading-card";

function commonsLabel(code: string, t: Awaited<ReturnType<typeof getTranslations<"today">>>) {
  const [name, group] = code.replace(/^_/, "").split("~");
  const known = ["Martyr", "Pastor", "Virgin", "Saint", "Mary", "Doctor", "Church"];
  if (!known.includes(name)) return name;
  const base = t(`commonsName.${name}` as "commonsName.Martyr");
  return group && ["1", "2", "3", "4", "5", "6"].includes(group)
    ? `${base} (${t(`commonsGroup.${group}` as "commonsGroup.1")})`
    : base;
}

export async function TodayView({ day }: { day: TodayWithText }) {
  const t = await getTranslations("today");
  const locale = await getLocale();
  const [books, reflections] = await Promise.all([allBooks(), publicReflections(day.date)]);
  // The reader's language first; the other language when that is all there is.
  const reflection = reflections.find((r) => r.language === locale) ?? reflections[0] ?? null;
  const reflectionSource = reflection ? await publicBible.attribution(reflection.sourceId) : null;
  const card = (slot: Parameters<typeof ReadingCard>[0]["slot"], key: string) => (
    <ReadingCard
      key={key}
      slot={slot}
      passages={day.passages}
      translation={day.translation}
      canonOrder={day.canonOrder}
      books={books}
    />
  );

  return (
    <article className="space-y-6">
      <DayHeader day={day} />

      {day.masses.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t("noReadings")} />
      ) : (
        day.masses.map((mass) => (
          <section key={mass.key} aria-labelledby={`mass-${mass.key}`} className="space-y-3">
            <h2 id={`mass-${mass.key}`} className="text-lg font-semibold">
              {day.masses.length > 1 ? t(`mass.${mass.key}`) : t("readings")}
            </h2>
            {visibleSlots(mass.slots).map((slot) => card(slot, `${mass.key}-${slot.type}-${slot.sequence}`))}
          </section>
        ))
      )}

      {day.memorials.map((memorial) => {
        const name = locale === "ta" ? memorial.nameTa : memorial.nameEn;
        return (
          <details key={memorial.celebrationCode} className="border-border bg-surface-muted rounded-2xl border p-4">
            <summary className="text-fg cursor-pointer font-semibold">{t("memorialReadings", { name })}</summary>
            <div className="mt-3 space-y-3">
              {visibleSlots(memorial.slots).map((slot) =>
                card(slot, `${memorial.celebrationCode}-${slot.type}-${slot.sequence}`),
              )}
              {memorial.commons.length ? (
                <p className="text-fg-muted text-sm">
                  {t("commons", { list: memorial.commons.map((c) => commonsLabel(c, t)).join(", ") })}
                </p>
              ) : null}
            </div>
          </details>
        );
      })}

      {reflection ? (
        <section aria-labelledby="reflection" className="border-gold/40 bg-surface space-y-3 rounded-2xl border p-5">
          <p className="text-gold text-sm font-semibold">{t("reflection")}</p>
          <h2 id="reflection" lang={reflection.language} className="text-xl font-bold">
            {reflection.title}
          </h2>
          {reflection.body.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i} lang={reflection.language} className="reading text-fg max-w-none whitespace-pre-line">
              {paragraph}
            </p>
          ))}
          <p className="text-fg-muted text-sm">
            {reflection.author}
            {reflectionSource ? ` · ${reflectionSource}` : null}
          </p>
        </section>
      ) : null}

      {day.translation ? (
        <p className="text-fg-muted text-sm">{t("textFrom", { name: day.translation.name })}</p>
      ) : null}
    </article>
  );
}
