import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Plus, ScrollText } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { adminDb, listSources } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminSources");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminSourcesPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/sources` });
  const t = await getTranslations("adminSources");
  const sources = await listSources(await adminDb());

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        {isPublisher(user.roles) ? (
          <Link href="/admin/sources/new" className={buttonClasses({ size: "sm" })}>
            <Plus aria-hidden className="size-4" />
            {t("new")}
          </Link>
        ) : null}
      </PageHeader>
      {sources.length === 0 ? (
        <EmptyState icon={ScrollText} title={t("title")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {sources.map((s) => {
            const usable = s.permission_status === "verified" && s.license_type !== "unknown";
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/sources/${s.id}`}
                  className="hover:bg-surface-muted flex flex-col gap-1 p-4 sm:flex-row sm:items-center"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-fg block font-medium">{s.name}</span>
                    <span className="text-fg-muted block text-sm">
                      {t(`licenseTypes.${s.license_type}` as "licenseTypes.unknown")}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "w-fit rounded-full px-3 py-1 text-sm",
                      usable ? "bg-accent-soft text-accent" : "bg-surface-muted text-lit-red",
                    )}
                  >
                    {t(`permission.${s.permission_status}` as "permission.pending")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
