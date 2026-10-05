import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { deleteMedia } from "@/lib/admin/media-actions";
import { mediaRowSchema } from "@/lib/admin/media-data";
import { mediaUrl } from "@/lib/content/saints";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { MediaForm } from "@/components/admin/media-forms";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminMedia");
  return { title: t("edit"), robots: { index: false } };
}

export default async function EditMediaPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/media/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await adminDb();
  const [options, { data }, { data: users }] = await Promise.all([
    contentFormOptions(db, user),
    db.from("media").select("*").eq("id", id).maybeSingle(),
    db.from("saints").select("id, name_en, name_ta").eq("image_media_id", id),
  ]);
  if (!data) notFound();
  const m = mediaRowSchema.parse(data);
  const saints = z
    .array(z.object({ id: z.string(), name_en: z.string(), name_ta: z.string() }))
    .catch([])
    .parse(users);
  const t = await getTranslations();
  const url = mediaUrl(m.storage_path);
  const alt = (locale === "ta" ? (m.alt_ta ?? m.alt_en) : (m.alt_en ?? m.alt_ta)) ?? "";
  const statuses = options.statuses.some((s) => s.value === m.status)
    ? options.statuses
    : [{ value: m.status, label: t(`status.${m.status}`) }, ...options.statuses];

  return (
    <>
      <PageHeader title={alt || t("adminMedia.edit")} description={t("adminMedia.edit")}>
        {isPublisher(user.roles) ? <DeleteButton id={m.id} action={deleteMedia} /> : null}
      </PageHeader>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- images from Supabase storage
          <img src={url} alt={alt} className="border-border max-h-72 rounded-2xl border object-contain" />
        ) : null}
        <div className="text-sm">
          <p className="text-fg-muted">
            {t("adminMedia.size", { width: m.width ?? 0, height: m.height ?? 0, kb: Math.round(m.bytes / 1024) })}
          </p>
          <p className="mt-3 font-medium">{t("adminMedia.usedBy")}</p>
          {saints.length ? (
            <ul>
              {saints.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/saints/${s.id}`} className="text-accent hover:underline">
                    {locale === "ta" ? s.name_ta : s.name_en}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted">{t("adminMedia.notUsed")}</p>
          )}
        </div>
      </div>
      <MediaForm
        id={m.id}
        initial={{
          altEn: m.alt_en ?? "",
          altTa: m.alt_ta ?? "",
          attribution: m.attribution_text ?? "",
          sourceId: m.source_id,
          status: m.status,
        }}
        sources={options.sources}
        statuses={statuses}
      />
    </>
  );
}
