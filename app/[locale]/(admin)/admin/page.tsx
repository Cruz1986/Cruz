import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("dashboard"), robots: { index: false } };
}

export default async function AdminDashboardPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin` });
  const t = await getTranslations();

  return (
    <>
      <PageHeader title={t("admin.dashboard")} description={t("admin.welcome", { email: user.email ?? "" })} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("admin.yourRoles")}</CardTitle>
          <ul className="mt-3 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <li key={role} className="bg-accent-soft text-accent rounded-full px-3 py-1 text-sm font-medium">
                {t(`roles.${role}`)}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="text-fg-muted">{t("admin.dashboardNote")}</p>
        </Card>
      </div>
    </>
  );
}
