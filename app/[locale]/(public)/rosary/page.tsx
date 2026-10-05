import { getLocale, getTranslations } from "next-intl/server";
import { Flower2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { publicRosary } from "@/lib/content/rosary";
import { buildSequence } from "@/lib/rosary/sequence";
import { todaysMysteries } from "@/lib/rosary/today";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ResumeCard } from "@/components/rosary/resume-card";

export const revalidate = 300;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "rosary");
}

export default async function RosaryPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations();
  const locale = await getLocale();
  const data = await publicRosary();
  if (!data) {
    return (
      <>
        <PageHeader title={t("pages.rosary.title")} description={t("pages.rosary.description")} />
        <EmptyState icon={Flower2} title={t("rosary.unavailable")} body={t("rosary.unavailableBody")} />
      </>
    );
  }

  const today = todaysMysteries(data.sets);
  const name = (s: (typeof data.sets)[number]) => (locale === "ta" ? s.nameTa : s.nameEn);
  const dayName = (isoDay: number) =>
    new Intl.DateTimeFormat(`${locale}-IN`, { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 1, 1 + (isoDay % 7))),
    );
  const ordered = [...data.sets].sort((a, b) => (a.key === today ? -1 : b.key === today ? 1 : 0));
  const total = buildSequence(data.steps).length;

  return (
    <>
      <PageHeader title={t("pages.rosary.title")} description={t("pages.rosary.description")} />
      <div className="space-y-6">
        <ResumeCard names={Object.fromEntries(data.sets.map((s) => [s.key, name(s)]))} total={total} />
        {ordered.map((set) => (
          <section
            key={set.key}
            aria-labelledby={`set-${set.key}`}
            className={cn("bg-surface rounded-2xl border p-5", set.key === today ? "border-accent" : "border-border")}
          >
            {set.key === today ? (
              <p className="text-gold text-sm font-semibold">{t("rosary.todaysMysteries")}</p>
            ) : null}
            <h2 id={`set-${set.key}`} className="text-xl font-semibold">
              {name(set)}
            </h2>
            <p className="text-fg-muted text-sm">
              {t("rosary.weekdays", { days: set.weekdays.map(dayName).join(", ") })}
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-6">
              {data.mysteries[set.key].map((m) => (
                <li key={m.number}>{locale === "ta" ? m.titleTa : m.titleEn}</li>
              ))}
            </ol>
            <Link
              href={`/rosary/${set.key}`}
              className={buttonClasses({ className: "mt-4", variant: set.key === today ? "primary" : "secondary" })}
            >
              {t("rosary.prayShort")}
            </Link>
          </section>
        ))}
      </div>
    </>
  );
}
