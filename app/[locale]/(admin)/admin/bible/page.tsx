import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { BookOpen } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("bible"), robots: { index: false } };
}

const rowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  language: z.string(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  source_id: z.string(),
  content_sources: z.object({ name: z.string(), permission_status: z.enum(["verified", "pending", "restricted"]) }),
});

export default async function AdminBiblePage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/bible` });
  const t = await getTranslations();
  const format = await getFormatter();
  const db = await createSupabaseServerClient();
  if (!db) notFound();

  const { data, error } = await db
    .from("bible_translations")
    .select("id, code, name, language, status, source_id, content_sources(name, permission_status)")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const translations = z.array(rowSchema).parse(data);

  const details = await Promise.all(
    translations.map(async (tr) => {
      const [{ count }, { data: batch }] = await Promise.all([
        db.from("bible_verses").select("id", { count: "exact", head: true }).eq("translation_id", tr.id),
        db
          .from("import_batches")
          .select("finished_at, status")
          .eq("kind", "bible")
          .eq("source_id", tr.source_id)
          .eq("status", "succeeded")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { verses: count ?? 0, lastImport: batch?.finished_at ?? null };
    }),
  );

  return (
    <>
      <PageHeader title={t("admin.bible")} description={t("admin.translations")}>
        <Link href="/admin/bible/books" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {t("adminBible.books")}
        </Link>
      </PageHeader>
      {translations.length === 0 ? (
        <EmptyState icon={BookOpen} title={t("admin.noTranslations")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {translations.map((tr, i) => (
            <li key={tr.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-fg font-semibold" lang={tr.language}>
                  {tr.name} <span className="text-fg-muted font-normal">({tr.code})</span>
                </p>
                <p className="text-fg-muted text-sm">
                  {t("admin.verseCount", { count: details[i].verses })}
                  {details[i].lastImport
                    ? ` · ${t("admin.lastImport", { date: format.dateTime(new Date(details[i].lastImport!), { dateStyle: "medium" }) })}`
                    : null}
                </p>
                <p className="text-fg-muted text-sm">
                  {t("admin.source")}: {tr.content_sources.name}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="bg-surface-muted rounded-full px-3 py-1">{t(`status.${tr.status}`)}</span>
                <span
                  className={
                    tr.content_sources.permission_status === "verified"
                      ? "bg-lit-green/15 text-lit-green rounded-full px-3 py-1"
                      : "bg-lit-red/10 text-lit-red rounded-full px-3 py-1"
                  }
                >
                  {t(`status.${tr.content_sources.permission_status}`)}
                </span>
                <Link
                  href={`/admin/bible/${tr.code}/settings`}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  {t("adminCommon.edit")}
                </Link>
                <Link
                  href={`/admin/bible/${tr.code}/jhn/1`}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  {t("admin.preview")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
