import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "./routing";

export type LocaleParams = { params: Promise<{ locale: string }> };

/** Validates the route locale and enables static rendering for the page. */
export async function initPage(params: LocaleParams["params"]): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

export type PageKey =
  "today" | "bible" | "prayers" | "rosary" | "saints" | "calendar" | "more" | "settings" | "credits" | "login";

export async function pageMetadata(params: LocaleParams["params"], key: PageKey): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t(`${key}.title`), description: t(`${key}.description`) };
}
