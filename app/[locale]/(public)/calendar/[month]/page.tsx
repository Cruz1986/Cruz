import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { parseMonth } from "@/lib/liturgy/months";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { CalendarMonth } from "@/components/calendar/calendar-month";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; month: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, month } = await params;
  const parsed = parseMonth(month);
  if (!parsed) return {};
  const t = await getTranslations("pages.calendar");
  const name = new Intl.DateTimeFormat(`${locale}-IN`, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(parsed.year, parsed.month - 1, 1)),
  );
  return { title: `${t("title")} · ${name}` };
}

export default async function CalendarMonthPage({ params }: Props) {
  await initPage(params);
  const parsed = parseMonth((await params).month);
  if (!parsed) notFound();
  return <CalendarMonth year={parsed.year} month={parsed.month} today={toIso(todayIn(DEFAULT_TIME_ZONE))} />;
}
