import { getTranslations } from "next-intl/server";
import { CalendarDays } from "lucide-react";
import { DEFAULT_CALENDAR } from "@/lib/content/today";
import { publicCalendarMonth } from "@/lib/content/calendar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthView } from "./month-view";

/** Loads a month and shows it, or explains why it can't. */
export async function CalendarMonth({ year, month, today }: { year: number; month: number; today: string }) {
  const t = await getTranslations();
  const days = await publicCalendarMonth(DEFAULT_CALENDAR, year, month);
  if (days === null) {
    return (
      <>
        <PageHeader title={t("pages.calendar.title")} />
        <EmptyState icon={CalendarDays} title={t("today.unavailable")} body={t("today.unavailableBody")} />
      </>
    );
  }
  if (days.length === 0) {
    return (
      <>
        <PageHeader title={t("pages.calendar.title")} />
        <EmptyState icon={CalendarDays} title={t("calendar.notGenerated")} body={t("calendar.notGeneratedBody")} />
      </>
    );
  }
  return <MonthView year={year} month={month} days={days} today={today} />;
}
