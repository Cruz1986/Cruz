import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ImageIcon, Upload } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { listMedia } from "@/lib/admin/media-data";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMedia");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminMediaPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/media` });
  const t = await getTranslations();
  const media = await listMedia(await adminDb());

  return (
    <>
      <PageHeader title={t("adminMedia.title")} description={t("adminMedia.description")}>
        <Link href="/admin/media/new" className={buttonClasses({ size: "sm" })}>
          <Upload aria-hidden className="size-4" />
          {t("adminMedia.upload")}
        </Link>
      </PageHeader>
      {media.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t("adminCommon.noItems")} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => {
            const alt = (locale === "ta" ? (m.alt_ta ?? m.alt_en) : (m.alt_en ?? m.alt_ta)) ?? "";
            return (
              <li key={m.id}>
                <Link
                  href={`/admin/media/${m.id}`}
                  className="border-border bg-surface hover:border-accent block overflow-hidden rounded-2xl border"
                >
                  {m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- images from Supabase storage
                    <img
                      src={m.url}
                      alt={alt}
                      loading="lazy"
                      className="bg-surface-muted aspect-square w-full object-cover"
                    />
                  ) : (
                    <span className="bg-surface-muted block aspect-square" />
                  )}
                  <span className="block p-2 text-sm">
                    <span className="line-clamp-1">{alt}</span>
                    <span className="text-fg-muted text-xs">{t(`status.${m.status}`)}</span>
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
