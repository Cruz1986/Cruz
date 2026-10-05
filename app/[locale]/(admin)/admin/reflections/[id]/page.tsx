import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { contentFormOptions } from "@/lib/admin/prayer-admin-data";
import { deleteReflection } from "@/lib/admin/reflection-actions";
import { getReflection } from "@/lib/content/reflections";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClasses } from "@/components/ui/button";
import { DeleteButton } from "@/components/admin/delete-button";
import { ReflectionForm } from "@/components/admin/reflection-form";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminReflections");
  return { title: t("edit"), robots: { index: false } };
}

export default async function EditReflectionPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/reflections/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await adminDb();
  const [options, r] = await Promise.all([contentFormOptions(db, user), getReflection(db, id)]);
  if (!r) notFound();
  const t = await getTranslations();
  const statuses = options.statuses.some((s) => s.value === r.status)
    ? options.statuses
    : [{ value: r.status, label: t(`status.${r.status}`) }, ...options.statuses];

  return (
    <>
      <PageHeader title={r.title} description={t("adminReflections.edit")}>
        <div className="flex flex-wrap gap-2">
          <Link href={`/today/${r.date}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <ExternalLink aria-hidden className="size-4" />
            {t("adminReflections.openDay")}
          </Link>
          {isPublisher(user.roles) ? <DeleteButton id={r.id} action={deleteReflection} /> : null}
        </div>
      </PageHeader>
      <ReflectionForm
        id={r.id}
        initial={{
          date: r.date,
          language: r.language,
          title: r.title,
          body: r.body,
          author: r.author,
          sourceId: r.sourceId,
          status: r.status,
        }}
        sources={options.sources}
        statuses={statuses}
      />
    </>
  );
}
