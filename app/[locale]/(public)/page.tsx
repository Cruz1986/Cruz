import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpenText } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { DEFAULT_CALENDAR, publicToday } from "@/lib/content/today";
import { allBooks } from "@/lib/content/public-bible";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { formatRanges, vkeyRanges } from "@/lib/liturgy/readings";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { LiturgicalColorBadge } from "@/components/ui/liturgical-color-badge";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { TodayDate } from "@/components/home/today-date";

// The Today card follows the date in India; refreshed every few minutes.
export const revalidate = 300;

const QUICK_ACTIONS = [NAV_ITEMS.bible, NAV_ITEMS.prayers, NAV_ITEMS.rosary];
const READINGS = ["first", "psalm", "second"] as const;

export default async function HomePage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations();
  const date = toIso(todayIn(DEFAULT_TIME_ZONE));
  const [day, books] = await Promise.all([publicToday(DEFAULT_CALENDAR, date, locale), allBooks()]);
  const SaintIcon = NAV_ITEMS.saints.icon;

  const mass = day?.masses.find((m) => m.key === "day") ?? day?.masses.at(-1);
  const slot = (type: string) => mass?.slots.find((s) => s.type === type);
  const reference = (type: string) => {
    const option = slot(type)?.options[0];
    if (!option) return null;
    if (locale === "ta" || !option.ranges.length) return option.reference;
    return formatRanges(option.ranges, (code) => books.get(code)?.abbrEn ?? code);
  };
  const gospel = slot("gospel")?.options[0];
  const gospelText =
    gospel && day
      ? vkeyRanges(gospel.ranges, day.canonOrder).flatMap(([a, b]) => day.passages.get(`${a}-${b}`) ?? [])
      : [];
  const memorials = day?.celebrations.filter((c) => !c.isPrimary) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-gold text-sm font-medium">{t("home.todayLabel")}</p>
        <TodayDate />
        {day ? (
          <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3">
            <span className="text-fg font-medium">{locale === "ta" ? day.titleTa : day.titleEn}</span>
            <LiturgicalColorBadge color={day.color} />
          </div>
        ) : null}
      </header>

      <Card className="border-accent/30 bg-accent-soft">
        <CardEyebrow className="flex items-center gap-2">
          <BookOpenText aria-hidden className="size-4" />
          {t("home.gospelTitle")}
          {reference("gospel") ? <span className="text-fg font-semibold">· {reference("gospel")}</span> : null}
        </CardEyebrow>
        {gospelText.length && day?.translation ? (
          <p lang={day.translation.language} className="reading text-fg mt-3 line-clamp-4">
            {gospelText.map((v) => v.text.replace(/\n/g, " ")).join(" ")}
          </p>
        ) : (
          <p className="reading text-fg-muted mt-3">{t("home.gospelEmpty")}</p>
        )}
        <Link href={NAV_ITEMS.today.href} className={buttonClasses({ className: "mt-5" })}>
          {t("home.read")}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("home.readings")}</CardTitle>
          <ul className="divide-border mt-3 divide-y">
            {READINGS.filter((type) => !day || slot(type)).map((type) => (
              <li key={type}>
                <Link
                  href={NAV_ITEMS.today.href}
                  className="text-fg hover:text-accent flex min-h-12 items-center justify-between gap-3 py-2"
                >
                  <span>
                    {t(`today.reading.${type}`)}
                    {reference(type) ? <span className="text-fg-muted block text-sm">{reference(type)}</span> : null}
                  </span>
                  <ArrowRight aria-hidden className="text-fg-muted size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2">
            <SaintIcon aria-hidden className="text-gold size-5" />
            {t("home.saintOfDay")}
          </CardTitle>
          {memorials.length ? (
            <ul className="mt-3 space-y-1">
              {memorials.map((c) => (
                <li key={c.code} className="text-fg">
                  {locale === "ta" ? c.nameTa : c.nameEn}
                  <span className="text-fg-muted text-sm"> · {t(`today.kind.${c.kind}` as "today.kind.memorial")}</span>
                </li>
              ))}
            </ul>
          ) : day?.celebrations[0] && day.kind !== "weekday" && day.kind !== "sunday" ? (
            <p className="text-fg mt-3">{locale === "ta" ? day.titleTa : day.titleEn}</p>
          ) : (
            <p className="text-fg-muted mt-3">{t("states.comingSoonBody")}</p>
          )}
          <Link
            href={NAV_ITEMS.saints.href}
            className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}
          >
            {t("nav.saints")}
          </Link>
        </Card>
      </div>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="mb-3 text-lg font-semibold">
          {t("home.quickActions")}
        </h2>
        <ul className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ key, href, icon: Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="border-border bg-surface text-fg hover:border-accent hover:text-accent flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center font-medium"
              >
                <Icon aria-hidden className="size-6" />
                <span className="text-sm">{t(`nav.${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
