import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { HandHeart, Plus } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { listCategories, listPrayers, prayerTitle } from "@/lib/content/prayers";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPrayers");
  return { title: t("prayers"), robots: { index: false } };
}

export default async function AdminPrayersPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/prayers` });
  const db = await createSupabaseServerClient();
  if (!db) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const [prayers, categories] = await Promise.all([listPrayers(db), listCategories(db)]);
  const categoryName = new Map(categories.map((c) => [c.id, locale === "ta" ? c.nameTa : c.nameEn]));

  return (
    <>
      <PageHeader title={t("adminPrayers.prayers")}>
        <Link href="/admin/prayers/new" className={buttonClasses({ size: "sm" })}>
          <Plus aria-hidden className="size-4" />
          {t("adminPrayers.newPrayer")}
        </Link>
      </PageHeader>
      {prayers.length === 0 ? (
        <EmptyState icon={HandHeart} title={t("adminPrayers.noPrayers")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {prayers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/prayers/${p.id}`}
                className="hover:bg-surface-muted flex flex-col gap-1 p-4 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-fg block font-medium">{prayerTitle(p, locale)}</span>
                  <span className="text-fg-muted block text-sm">
                    {categoryName.get(p.categoryId)} ·{" "}
                    {[p.hasTa && "தமிழ்", p.hasEn && "English"].filter(Boolean).join(" + ")} ·{" "}
                    {t("adminPrayers.updated", {
                      date: format.dateTime(new Date(p.updatedAt), { dateStyle: "medium" }),
                    })}
                  </span>
                </span>
                <span className="bg-surface-muted w-fit rounded-full px-3 py-1 text-sm">{t(`status.${p.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
