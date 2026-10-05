import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { monthNames } from "@/lib/saints/helpers";
import { PageHeader } from "@/components/ui/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminCalendar");
  return { title: t("allCelebrations"), robots: { index: false } };
}

export default async function CelebrationsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/calendar/celebrations` });
  const t = await getTranslations();
  const { data, error } = await (
    await adminDb()
  )
    .from("celebrations")
    .select("id, name_en, name_ta, rank, month, day, names_locked")
    .neq("rank", "weekday")
    .order("month", { nullsFirst: false })
    .order("day")
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = z
    .array(
      z.object({
        id: z.string(),
        name_en: z.string(),
        name_ta: z.string(),
        rank: z.string(),
        month: z.number().nullable(),
        day: z.number().nullable(),
        names_locked: z.boolean(),
      }),
    )
    .parse(data);
  const months = monthNames(locale);
  const groups = [
    ...months.map((name, i) => ({ name, rows: rows.filter((r) => r.month === i + 1) })),
    { name: t("adminCalendar.movable"), rows: rows.filter((r) => r.month === null) },
  ].filter((g) => g.rows.length);

  return (
    <>
      <PageHeader title={t("adminCalendar.allCelebrations")} description={t("adminCalendar.locked")} />
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.name} className="border-border bg-surface rounded-2xl border p-4">
            <h2 className="text-gold mb-2 font-semibold">{g.name}</h2>
            <ul className="divide-border divide-y">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/calendar/celebrations/${r.id}`}
                    className="hover:bg-surface-muted flex gap-3 rounded-lg px-2 py-1.5 text-sm"
                  >
                    <span className="text-fg-muted w-6 tabular-nums">{r.day ?? ""}</span>
                    <span className="flex-1">{locale === "ta" ? r.name_ta : r.name_en}</span>
                    {r.names_locked ? <span className="text-gold text-xs">{t("adminCalendar.edited")}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
