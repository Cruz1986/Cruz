import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Noto_Sans_Tamil, Noto_Serif_Tamil } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/lib/i18n/routing";
import { preferencesInitScript } from "@/lib/preferences";
import { PreferencesProvider } from "@/components/preferences/preferences-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SkipLink } from "@/components/layout/skip-link";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoSansTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-sans-tamil",
  display: "swap",
});
const notoSerifTamil = Noto_Serif_Tamil({
  subsets: ["tamil", "latin"],
  variable: "--font-noto-serif-tamil",
  display: "swap",
});

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "app" });
  return {
    title: { default: t("name"), template: `%s · ${t("shortName")}` },
    description: t("description"),
    applicationName: t("name"),
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111317" },
  ],
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      // The pre-paint script sets data-theme / --font-scale before hydration.
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansTamil.variable} ${notoSerifTamil.variable}`}
    >
      <head>
        {/* Static constant, no user input: safe to inline. */}
        <script dangerouslySetInnerHTML={{ __html: preferencesInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <PreferencesProvider>
            <SkipLink />
            <SiteHeader />
            <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pt-6 pb-28 lg:pb-12">
              {children}
            </main>
            <BottomNav />
          </PreferencesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
