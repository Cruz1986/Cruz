import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { CalendarMonth } from "@/components/calendar/calendar-month";

// The current month follows India's date; refreshed every few minutes.
export const revalidate = 300;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "calendar");
}

export default async function CalendarPage({ params }: LocaleParams) {
  await initPage(params);
  const today = todayIn(DEFAULT_TIME_ZONE);
  return <CalendarMonth year={today.year} month={today.month} today={toIso(today)} />;
}
