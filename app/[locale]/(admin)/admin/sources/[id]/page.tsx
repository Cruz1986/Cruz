import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { adminDb, sourceRowSchema, staffNames } from "@/lib/admin/data";
import { deleteSource } from "@/lib/admin/source-actions";
import { PageHeader } from "@/components/ui/page-header";
import { SourceForm } from "@/components/admin/source-form";
import { DeleteButton } from "@/components/admin/delete-button";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminSources");
  return { title: t("edit"), robots: { index: false } };
}

export default async function EditSourcePage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/sources/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await adminDb();
  const { data } = await db.from("content_sources").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const s = sourceRowSchema.parse(data);
  const t = await getTranslations("adminSources");
  const format = await getFormatter();
  const reviewer = (await staffNames(db, [s.reviewed_by])).get(s.reviewed_by ?? "");

  return (
    <>
      <PageHeader title={s.name} description={t("edit")}>
        {user.roles.includes("super_admin") ? <DeleteButton id={s.id} action={deleteSource} /> : null}
      </PageHeader>
      {s.reviewed_at ? (
        <p className="text-fg-muted mb-4 text-sm">
          {t("reviewed", {
            name: reviewer ?? "—",
            date: format.dateTime(new Date(s.reviewed_at), { dateStyle: "medium" }),
          })}
        </p>
      ) : null}
      {!isPublisher(user.roles) ? (
        <p className="bg-surface-muted mb-4 rounded-xl p-3 text-sm">{t("publishersOnly")}</p>
      ) : null}
      <SourceForm
        id={s.id}
        initial={{
          name: s.name,
          copyrightHolder: s.copyright_holder ?? "",
          licenseType: s.license_type,
          permissionStatus: s.permission_status,
          attribution: s.attribution_text ?? "",
          approval: s.ecclesiastical_approval ?? "",
          licenseUrl: s.license_url ?? "",
          notes: s.notes ?? "",
        }}
      />
    </>
  );
}
