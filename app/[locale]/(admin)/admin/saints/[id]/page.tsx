import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExternalLink, Trash2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { getSaintBy } from "@/lib/content/saints";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { deleteSaint } from "@/lib/admin/saint-actions";
import { monthNames, saintName } from "@/lib/saints/helpers";
import { listMedia } from "@/lib/admin/media-data";
import { PageHeader } from "@/components/ui/page-header";
import { Button, buttonClasses } from "@/components/ui/button";
import { SaintForm } from "@/components/admin/saint-form";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminSaints");
  return { title: t("editSaint"), robots: { index: false } };
}

const str = (v: number | string | null) => (v === null ? "" : String(v));

export default async function EditSaintPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/saints/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createSupabaseServerClient();
  if (!db) notFound();
  const t = await getTranslations();
  const [options, saint, media] = await Promise.all([
    contentFormOptions(db, user),
    getSaintBy(db, "id", id),
    listMedia(db),
  ]);
  if (!saint) notFound();

  // Statuses the user may choose, plus the current one so the form shows it truthfully.
  const statuses = options.statuses.some((s) => s.value === saint.status)
    ? options.statuses
    : [{ value: saint.status, label: t(`status.${saint.status}`) }, ...options.statuses];

  return (
    <>
      <PageHeader title={saintName(saint, locale)} description={t("adminSaints.editSaint")}>
        <div className="flex flex-wrap gap-2">
          {saint.status === "published" ? (
            <Link href={`/saints/${saint.slug}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              <ExternalLink aria-hidden className="size-4" />
              {t("adminPrayers.form.viewPublic")}
            </Link>
          ) : null}
          {isPublisher(user.roles) ? (
            <form action={deleteSaint}>
              <input type="hidden" name="id" value={saint.id} />
              <input type="hidden" name="locale" value={locale} />
              <Button type="submit" variant="ghost" size="sm" className="text-lit-red">
                <Trash2 aria-hidden className="size-4" />
                {t("adminSaints.form.delete")}
              </Button>
            </form>
          ) : null}
        </div>
      </PageHeader>
      <SaintForm
        initial={{
          id: saint.id,
          slug: saint.slug,
          sourceId: saint.sourceId,
          status: saint.status,
          nameEn: saint.nameEn,
          nameTa: saint.nameTa,
          titleEn: saint.titleEn ?? "",
          titleTa: saint.titleTa ?? "",
          feastMonth: str(saint.feastMonth),
          feastDay: str(saint.feastDay),
          birthYear: str(saint.birthYear),
          deathYear: str(saint.deathYear),
          patronageEn: saint.patronageEn ?? "",
          patronageTa: saint.patronageTa ?? "",
          biographyEn: saint.biographyEn ?? "",
          biographyTa: saint.biographyTa ?? "",
          imageMediaId: saint.imageMediaId ?? "",
        }}
        images={media.map((m) => ({
          value: m.id,
          label: (locale === "ta" ? (m.alt_ta ?? m.alt_en) : (m.alt_en ?? m.alt_ta)) ?? m.id,
        }))}
        sources={options.sources}
        statuses={statuses}
        monthNames={monthNames(locale)}
      />
    </>
  );
}
