import type { ReactNode } from "react";
import { initPage } from "@/lib/i18n/page";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Every layout and page must set the locale itself (they render in parallel) to stay static.
  await initPage(params);
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pt-6 pb-28 lg:pb-12">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
