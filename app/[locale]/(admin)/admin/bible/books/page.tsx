import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminBible");
  return { title: t("books"), robots: { index: false } };
}

export default async function AdminBooksPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/bible/books` });
  const t = await getTranslations("adminBible");
  const { data, error } = await (
    await adminDb()
  )
    .from("bible_books")
    .select("code, name_en, name_ta, abbr_en, abbr_ta")
    .order("canon_order");
  if (error) throw new Error(error.message);
  const books = z
    .array(
      z.object({
        code: z.string(),
        name_en: z.string(),
        name_ta: z.string(),
        abbr_en: z.string(),
        abbr_ta: z.string(),
      }),
    )
    .parse(data);

  return (
    <>
      <PageHeader title={t("books")} description={t("booksDescription")} />
      <ul className="divide-border border-border bg-surface grid divide-y rounded-2xl border sm:grid-cols-2 sm:divide-y-0">
        {books.map((b) => (
          <li key={b.code} className="sm:border-border sm:border-b">
            <Link
              href={`/admin/bible/books/${b.code}`}
              className="hover:bg-surface-muted flex items-baseline gap-3 px-4 py-2"
            >
              <span className="text-fg-muted w-12 font-mono text-xs">{b.code}</span>
              <span className="flex-1">
                <span lang="ta">{b.name_ta}</span> · {b.name_en}
              </span>
              <span className="text-fg-muted text-sm">
                {b.abbr_ta} / {b.abbr_en}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
