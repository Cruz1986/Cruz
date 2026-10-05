import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus, Users } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { listSaints } from "@/lib/content/saints";
import { feastLabel, saintName } from "@/lib/saints/helpers";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminSaints");
  return { title: t("saints"), robots: { index: false } };
}

export default async function AdminSaintsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/saints` });
  const db = await createSupabaseServerClient();
  if (!db) notFound();
  const t = await getTranslations();
  const saints = await listSaints(db);

  return (
    <>
      <PageHeader title={t("adminSaints.saints")}>
        <Link href="/admin/saints/new" className={buttonClasses({ size: "sm" })}>
          <Plus aria-hidden className="size-4" />
          {t("adminSaints.newSaint")}
        </Link>
      </PageHeader>
      {saints.length === 0 ? (
        <EmptyState icon={Users} title={t("adminSaints.noSaints")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {saints.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/saints/${s.id}`}
                className="hover:bg-surface-muted flex flex-col gap-1 p-4 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-fg block font-medium">{saintName(s, locale)}</span>
                  <span className="text-fg-muted block text-sm">
                    {feastLabel(s.feastMonth, s.feastDay, locale) ?? "—"}
                  </span>
                </span>
                <span className="bg-surface-muted w-fit rounded-full px-3 py-1 text-sm">{t(`status.${s.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
