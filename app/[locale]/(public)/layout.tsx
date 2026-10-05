import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function PublicLayout({ children }: { children: ReactNode }) {
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
