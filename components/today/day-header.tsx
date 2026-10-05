import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { Today } from "@/lib/content/today";
import { LiturgicalColorBadge } from "@/components/ui/liturgical-color-badge";
import { buttonClasses } from "@/components/ui/button";
import { addDays, parseIsoDate, toIso } from "@/lib/liturgy/plain-date";

export function formatLongDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(`${locale}-IN`, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export async function DayHeader({ day, headingLevel = 1 }: { day: Today; headingLevel?: 1 | 2 }) {
  const t = await getTranslations("today");
  const locale = await getLocale();
  const date = parseIsoDate(day.date)!;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const others = day.celebrations.filter((c) => !c.isPrimary);

  return (
    <header className="space-y-3">
      <p className="text-gold text-sm font-medium">{formatLongDate(day.date, locale)}</p>
      <Heading className="text-fg text-2xl font-bold sm:text-3xl">
        {locale === "ta" ? day.titleTa : day.titleEn}
      </Heading>
      <div className="text-fg-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <LiturgicalColorBadge color={day.color} />
        <span>{t(`kind.${day.kind}` as "kind.weekday")}</span>
        <span>
          {day.week !== null && day.week > 0 && day.season !== "triduum"
            ? t("seasonWeek", { season: t(`season.${day.season}`), week: day.week })
            : t(`season.${day.season}`)}
        </span>
        <span>{t("cycles", { sunday: day.sundayCycle, weekday: day.weekdayCycle })}</span>
      </div>
      {others.length ? (
        <div className="text-sm">
          <span className="text-fg font-medium">{t("alsoToday")}: </span>
          <span className="text-fg-muted">
            {others.map((c, i) => (
              <span key={c.code}>
                {i > 0 ? " · " : null}
                {locale === "ta" ? c.nameTa : c.nameEn} ({t(`kind.${c.kind}` as "kind.memorial")})
              </span>
            ))}
          </span>
        </div>
      ) : null}
      {headingLevel === 1 ? (
        <nav aria-label={t("readings")} className="flex items-center justify-between gap-2 pt-1">
          <Link
            href={`/today/${toIso(addDays(date, -1))}`}
            rel="prev"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <ChevronLeft aria-hidden className="size-4" />
            {t("previousDay")}
          </Link>
          <Link
            href={`/today/${toIso(addDays(date, 1))}`}
            rel="next"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {t("nextDay")}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
