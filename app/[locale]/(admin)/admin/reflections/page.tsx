import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotebookText, Plus } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { listReflections } from "@/lib/content/reflections";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminReflections");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminReflectionsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/reflections` });
  const t = await getTranslations();
  const reflections = await listReflections(await adminDb());

  return (
    <>
      <PageHeader title={t("adminReflections.title")} description={t("adminReflections.description")}>
        <Link href="/admin/reflections/new" className={buttonClasses({ size: "sm" })}>
          <Plus aria-hidden className="size-4" />
          {t("adminReflections.new")}
        </Link>
      </PageHeader>
      {reflections.length === 0 ? (
        <EmptyState icon={NotebookText} title={t("adminCommon.noItems")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {reflections.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/reflections/${r.id}`}
                className="hover:bg-surface-muted flex flex-col gap-1 p-4 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1">
                  <span lang={r.language} className="text-fg block font-medium">
                    {r.title}
                  </span>
                  <span className="text-fg-muted block text-sm">
                    {r.date} · {r.language === "ta" ? t("adminCommon.tamil") : t("adminCommon.english")} · {r.author}
                  </span>
                </span>
                <span className="bg-surface-muted w-fit rounded-full px-3 py-1 text-sm">{t(`status.${r.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
