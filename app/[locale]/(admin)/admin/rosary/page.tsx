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
  const t = await getTranslations("adminRosary");
  return { title: t("title"), robots: { index: false } };
}

export default async function AdminRosaryPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/rosary` });
  const t = await getTranslations();
  const db = await adminDb();
  const { data, error } = await db
    .from("rosary_mystery_sets")
    .select("key, name_en, name_ta, sort_order, rosary_mysteries(id, number, title_en, title_ta, status)")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const sets = z
    .array(
      z.object({
        key: z.string(),
        name_en: z.string(),
        name_ta: z.string(),
        rosary_mysteries: z.array(
          z.object({
            id: z.string(),
            number: z.number(),
            title_en: z.string(),
            title_ta: z.string(),
            status: z.enum(["draft", "in_review", "published", "archived"]),
          }),
        ),
      }),
    )
    .parse(data);

  return (
    <>
      <PageHeader title={t("adminRosary.title")} description={t("adminRosary.description")} />
      <div className="grid gap-4 md:grid-cols-2">
        {sets.map((set) => (
          <section key={set.key} className="border-border bg-surface rounded-2xl border p-4">
            <h2 className="mb-2 font-semibold">{locale === "ta" ? set.name_ta : set.name_en}</h2>
            <ol className="divide-border divide-y">
              {set.rosary_mysteries
                .sort((a, b) => a.number - b.number)
                .map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/admin/rosary/${m.id}`}
                      className="hover:bg-surface-muted flex items-center gap-2 rounded-lg px-2 py-2"
                    >
                      <span className="text-fg-muted w-5 tabular-nums">{m.number}</span>
                      <span className="flex-1">{locale === "ta" ? m.title_ta : m.title_en}</span>
                      <span className="text-fg-muted text-xs">{t(`status.${m.status}`)}</span>
                    </Link>
                  </li>
                ))}
            </ol>
          </section>
        ))}
      </div>
    </>
  );
}
