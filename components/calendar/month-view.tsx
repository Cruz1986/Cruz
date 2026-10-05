import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { CalendarMonthDay } from "@/lib/content/calendar";
import { LITURGICAL_COLORS, type LiturgicalColor } from "@/lib/design/liturgical-colors";
import { monthKey, shiftMonth } from "@/lib/liturgy/months";
import { daysInMonth, plainDate, weekday } from "@/lib/liturgy/plain-date";
import { buttonClasses } from "@/components/ui/button";
import { LiturgicalColorBadge } from "@/components/ui/liturgical-color-badge";
import { cn } from "@/lib/cn";

const SWATCH: Record<LiturgicalColor, string> = {
  green: "bg-lit-green",
  violet: "bg-lit-violet",
  white: "bg-lit-white ring-1 ring-border",
  red: "bg-lit-red",
  rose: "bg-lit-rose",
  black: "bg-lit-black",
  gold: "bg-lit-gold",
};

function Swatch({ color, className }: { color: LiturgicalColor; className?: string }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rounded-full", SWATCH[color], className)} />;
}

function DayTitle({ day, locale }: { day: CalendarMonthDay; locale: string }) {
  const title = locale === "ta" ? day.titleTa : day.titleEn;
  return (
    <span
      className={cn(day.kind === "solemnity" && "text-fg font-bold", day.kind === "feast" && "text-fg font-semibold")}
    >
      {day.kind === "feast" ? "◆ " : null}
      {title}
    </span>
  );
}

/** Month of liturgical days: a grid on wide screens, a list on phones. Days link to their readings. */
export async function MonthView({
  year,
  month,
  days,
  today,
}: {
  year: number;
  month: number;
  days: CalendarMonthDay[];
  today: string;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const intl = `${locale}-IN`;
  const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const weekdayNames = [...Array(7)].map((_, i) =>
    new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 1, 1 + i))),
  ); // 1 Feb 2026 is a Sunday
  const longDate = (iso: string) =>
    new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const leading = weekday(plainDate(year, month, 1));
  const cells: (CalendarMonthDay | null | { empty: number })[] = [
    ...Array.from({ length: leading }, (_, i) => ({ empty: i })),
    ...Array.from(
      { length: daysInMonth(year, month) },
      (_, i) => byDate.get(`${monthKey(year, month)}-${String(i + 1).padStart(2, "0")}`) ?? null,
    ),
  ];
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const seasonStarts = new Set(days.filter((d, i) => i > 0 && days[i - 1].season !== d.season).map((d) => d.date));

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-fg text-2xl font-bold sm:text-3xl">
          {t("pages.calendar.title")} · {monthName}
        </h1>
        <nav aria-label={t("pages.calendar.title")} className="flex items-center justify-between gap-2">
          <Link
            href={`/calendar/${monthKey(prev.year, prev.month)}`}
            rel="prev"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <ChevronLeft aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">{t("calendar.previousMonth")}</span>
          </Link>
          <Link href="/calendar" className={buttonClasses({ variant: "ghost", size: "sm" })}>
            {t("calendar.thisMonth")}
          </Link>
          <Link
            href={`/calendar/${monthKey(next.year, next.month)}`}
            rel="next"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <span className="sr-only sm:not-sr-only">{t("calendar.nextMonth")}</span>
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </nav>
      </header>

      {/* Wide screens: month grid */}
      <table className="hidden w-full table-fixed border-collapse md:table">
        <caption className="sr-only">{monthName}</caption>
        <thead>
          <tr>
            {weekdayNames.map((name) => (
              <th key={name} scope="col" className="text-fg-muted pb-2 text-left text-sm font-medium">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((cell, i) =>
                cell === null || "empty" in cell ? (
                  <td key={i} className="border-border bg-surface-muted/40 border" />
                ) : (
                  <td key={cell.date} className="border-border bg-surface h-28 border align-top">
                    <Link
                      href={`/today/${cell.date}`}
                      aria-label={t("calendar.dayLink", {
                        date: longDate(cell.date),
                        title: locale === "ta" ? cell.titleTa : cell.titleEn,
                      })}
                      aria-current={cell.date === today ? "date" : undefined}
                      className={cn(
                        "hover:bg-surface-muted flex h-full flex-col gap-1 p-2 text-xs",
                        cell.date === today && "ring-accent ring-2 ring-inset",
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            weekday(plainDate(year, month, Number(cell.date.slice(8)))) === 0 && "text-lit-red",
                          )}
                        >
                          {Number(cell.date.slice(8))}
                        </span>
                        <Swatch color={cell.color} className="size-3" />
                      </span>
                      <span className="text-fg-muted line-clamp-3">
                        <DayTitle day={cell} locale={locale} />
                      </span>
                      {cell.memorials.length ? (
                        <span className="text-fg-muted line-clamp-2 italic">
                          {locale === "ta" ? cell.memorials[0].nameTa : cell.memorials[0].nameEn}
                        </span>
                      ) : null}
                    </Link>
                  </td>
                ),
              )}
              {week.length < 7
                ? Array.from({ length: 7 - week.length }, (_, i) => (
                    <td key={`pad${i}`} className="border-border bg-surface-muted/40 border" />
                  ))
                : null}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones: list of days */}
      <ol className="divide-border border-border bg-surface divide-y rounded-2xl border md:hidden">
        {days.map((day) => (
          <li key={day.date}>
            {seasonStarts.has(day.date) ? (
              <p className="bg-surface-muted text-gold px-4 py-2 text-sm font-semibold">
                {t("calendar.seasonStarts", { season: t(`today.season.${day.season}`) })}
              </p>
            ) : null}
            <Link
              href={`/today/${day.date}`}
              aria-current={day.date === today ? "date" : undefined}
              className={cn("hover:bg-surface-muted flex gap-3 px-4 py-3", day.date === today && "bg-accent-soft")}
            >
              <span className="w-10 shrink-0 text-center">
                <span className="block text-lg leading-tight font-semibold tabular-nums">
                  {Number(day.date.slice(8))}
                </span>
                <span className="text-fg-muted block text-xs">
                  {weekdayNames[weekday(plainDate(year, month, Number(day.date.slice(8))))]}
                </span>
              </span>
              <Swatch color={day.color} className="mt-1.5 size-3" />
              <span className="min-w-0 flex-1 text-sm">
                <DayTitle day={day} locale={locale} />
                {day.memorials.map((m) => (
                  <span key={m.code} className="text-fg-muted mt-0.5 block italic">
                    {locale === "ta" ? m.nameTa : m.nameEn}
                  </span>
                ))}
                {day.date === today ? (
                  <span className="text-accent mt-1 block text-xs font-semibold">{t("calendar.today")}</span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <section aria-labelledby="legend" className="border-border bg-surface rounded-2xl border p-4">
        <h2 id="legend" className="mb-2 text-sm font-semibold">
          {t("calendar.legend")}
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {LITURGICAL_COLORS.filter((c) => days.some((d) => d.color === c)).map((c) => (
            <LiturgicalColorBadge key={c} color={c} />
          ))}
        </div>
        <p className="text-fg-muted mt-2 text-sm">{t("calendar.legendNote")}</p>
      </section>
    </div>
  );
}
