import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { DEFAULT_CALENDAR, publicToday } from "@/lib/content/today";
import { parseIsoDate } from "@/lib/liturgy/plain-date";
import { TodayView } from "@/components/today/today-view";
import { formatLongDate } from "@/components/today/day-header";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, date } = await params;
  if (!parseIsoDate(date)) return {};
  const day = await publicToday(DEFAULT_CALENDAR, date, locale);
  const t = await getTranslations("today");
  return {
    title: day
      ? `${locale === "ta" ? day.titleTa : day.titleEn} · ${formatLongDate(date, locale)}`
      : t("dateHeading", { date }),
  };
}

export default async function TodayForDatePage({ params }: Props) {
  const locale = await initPage(params);
  const { date } = await params;
  if (!parseIsoDate(date)) notFound();
  const day = await publicToday(DEFAULT_CALENDAR, date, locale);
  if (!day) notFound();
  return <TodayView day={day} />;
}
