import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpenText } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { Card, CardEyebrow, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { TodayDate } from "@/components/home/today-date";

const QUICK_ACTIONS = [NAV_ITEMS.bible, NAV_ITEMS.prayers, NAV_ITEMS.rosary];
const READINGS = ["firstReading", "psalm", "secondReading"] as const;

export default async function HomePage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations();
  const SaintIcon = NAV_ITEMS.saints.icon;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-gold text-sm font-medium">{t("home.todayLabel")}</p>
        <TodayDate />
      </header>

      <Card className="border-accent/30 bg-accent-soft">
        <CardEyebrow className="flex items-center gap-2">
          <BookOpenText aria-hidden className="size-4" />
          {t("home.gospelTitle")}
        </CardEyebrow>
        <p className="reading text-fg-muted mt-3">{t("home.gospelEmpty")}</p>
        <Link href={NAV_ITEMS.today.href} className={buttonClasses({ className: "mt-5" })}>
          {t("home.read")}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("home.readings")}</CardTitle>
          <ul className="divide-border mt-3 divide-y">
            {READINGS.map((key) => (
              <li key={key}>
                <Link
                  href={NAV_ITEMS.today.href}
                  className="text-fg hover:text-accent flex min-h-12 items-center justify-between gap-3 py-2"
                >
                  {t(`home.${key}`)}
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
          <p className="text-fg-muted mt-3">{t("states.comingSoonBody")}</p>
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
