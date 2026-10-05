import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Megaphone, Plus } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { listAnnouncements } from "@/lib/admin/announcements";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminAnnouncements");
  return { title: t("title"), robots: { index: false } };
}

export default async function AnnouncementsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/notifications` });
  const t = await getTranslations("adminAnnouncements");
  const format = await getFormatter();
  const items = await listAnnouncements(await adminDb());

  return (
    <>
      <PageHeader title={t("title")} description={t("description")}>
        <Link href="/admin/notifications/new" className={buttonClasses({ size: "sm" })}>
          <Plus aria-hidden className="size-4" />
          {t("new")}
        </Link>
      </PageHeader>
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title={(await getTranslations("adminCommon"))("noItems")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/notifications/${a.id}`}
                className="hover:bg-surface-muted flex flex-col gap-1 p-4 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-fg block font-medium">{locale === "ta" ? a.title_ta : a.title_en}</span>
                  <span className="text-fg-muted block text-sm">
                    {format.dateTime(new Date(a.scheduled_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    })}
                    {a.status === "sent" ? ` · ${t("recipients", { count: a.recipients })}` : null}
                  </span>
                </span>
                <span className="bg-surface-muted w-fit rounded-full px-3 py-1 text-sm">{t(`status.${a.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
