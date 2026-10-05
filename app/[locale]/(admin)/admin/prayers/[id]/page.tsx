import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExternalLink, Trash2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { getPrayerBy, prayerTitle } from "@/lib/content/prayers";
import { prayerFormOptions } from "@/lib/admin/prayer-admin-data";
import { deletePrayer } from "@/lib/admin/prayer-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { PrayerForm } from "@/components/admin/prayer-form";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminPrayers");
  return { title: t("editPrayer"), robots: { index: false } };
}

export default async function EditPrayerPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/prayers/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("adminPrayers");
  const options = await prayerFormOptions(user, locale);
  const prayer = await getPrayerBy(options.db, "id", id);
  if (!prayer) notFound();

  // Statuses the user may choose, plus the current one so the form shows it truthfully.
  const statuses = options.statuses.some((s) => s.value === prayer.status)
    ? options.statuses
    : [{ value: prayer.status, label: (await getTranslations())(`status.${prayer.status}`) }, ...options.statuses];

  return (
    <>
      <PageHeader title={prayerTitle(prayer, locale)} description={t("editPrayer")}>
        <div className="flex flex-wrap gap-2">
          {prayer.status === "published" ? (
            <Link href={`/prayers/${prayer.slug}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <ExternalLink aria-hidden className="size-4" />
              {t("form.viewPublic")}
            </Link>
          ) : null}
          {isPublisher(user.roles) ? (
            <form action={deletePrayer}>
              <input type="hidden" name="id" value={prayer.id} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="ghost" size="sm" className="text-lit-red">
                <Trash2 aria-hidden className="size-4" />
                {t("form.delete")}
              </Button>
            </form>
          ) : null}
        </div>
      </PageHeader>
      <PrayerForm
        initial={{
          id: prayer.id,
          slug: prayer.slug,
          categoryId: prayer.categoryId,
          sourceId: prayer.sourceId,
          sortOrder: prayer.sortOrder,
          status: prayer.status,
          titleEn: prayer.titleEn ?? "",
          bodyEn: prayer.bodyEn ?? "",
          titleTa: prayer.titleTa ?? "",
          bodyTa: prayer.bodyTa ?? "",
        }}
        categories={options.categories}
        sources={options.sources}
        statuses={statuses}
      />
    </>
  );
}
