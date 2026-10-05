import type { ReactNode } from "react";
import { initPage } from "@/lib/i18n/page";
import { getSessionUser } from "@/lib/auth/session";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await initPage(params);
  // Display only (layouts do not re-run on client navigation); pages enforce access.
  const user = await getSessionUser();
  return (
    <>
      <AdminHeader roles={user?.roles ?? []} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </>
  );
}
