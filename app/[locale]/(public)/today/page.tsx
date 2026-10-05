import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { DEFAULT_CALENDAR, publicToday } from "@/lib/content/today";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TodayView } from "@/components/today/today-view";
import { LocalDateRedirect } from "@/components/today/local-date-redirect";

// Re-rendered every few minutes so the date rolls over at midnight (India time).
export const revalidate = 300;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "today");
}

export default async function TodayPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const t = await getTranslations();
  const date = toIso(todayIn(DEFAULT_TIME_ZONE));
  const day = await publicToday(DEFAULT_CALENDAR, date, locale);

  return (
    <>
      <LocalDateRedirect renderedDate={date} />
      {day ? (
        <TodayView day={day} />
      ) : (
        <>
          <PageHeader title={t("pages.today.title")} />
          <EmptyState icon={CalendarDays} title={t("today.unavailable")} body={t("today.unavailableBody")} />
        </>
      )}
    </>
  );
}
