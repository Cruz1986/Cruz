import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { publicSaints } from "@/lib/content/saints";
import { DEFAULT_CALENDAR } from "@/lib/content/today";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { feastLabel, monthNames } from "@/lib/saints/helpers";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SaintOfDay } from "@/components/saints/saint-of-day";
import { SaintDirectory } from "@/components/saints/saint-directory";

// The saint of the day follows the date in India.
export const revalidate = 300;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "saints");
}

export default async function SaintsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations();
  const [saints, today] = await Promise.all([
    publicSaints.list(),
    publicSaints.ofDay(DEFAULT_CALENDAR, toIso(todayIn(DEFAULT_TIME_ZONE))),
  ]);
  const todays = (await Promise.all(today.map((s) => publicSaints.bySlug(s.slug)))).filter((s) => s !== null);

  return (
    <>
      <PageHeader title={t("pages.saints.title")} description={t("pages.saints.description")} />
      {saints.length ? (
        <div className="space-y-8">
          <SaintOfDay saints={todays} />
          <SaintDirectory
            monthNames={monthNames(locale)}
            saints={saints.map((s) => ({ ...s, feastLabel: feastLabel(s.feastMonth, s.feastDay, locale) }))}
          />
        </div>
      ) : (
        <EmptyState icon={Sparkles} title={t("saints.unavailable")} body={t("saints.unavailableBody")} />
      )}
    </>
  );
}
