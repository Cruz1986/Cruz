import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/lib/i18n/navigation";
import { initPage, type LocaleParams } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb, staffNames } from "@/lib/admin/data";
import { CONTENT_STATUSES } from "@/lib/admin/fields";
import { AUDIT_TYPES, adminPath, rowLabel, type AuditType } from "@/lib/admin/audit";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("dashboard"), robots: { index: false } };
}

/** Content tables with the review workflow, and the column that names an item. */
const CONTENT = [
  { table: "prayers", label: "title_en", path: "/admin/prayers" },
  { table: "saints", label: "name_en", path: "/admin/saints" },
  { table: "reflections", label: "title", path: "/admin/reflections" },
  { table: "rosary_mysteries", label: "title_en", path: "/admin/rosary" },
  { table: "media", label: "alt_en", path: "/admin/media" },
] as const;

export default async function AdminDashboardPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin` });
  const t = await getTranslations();
  const format = await getFormatter();
  const db = await adminDb();

  const tables = await Promise.all(
    CONTENT.map(async (c) => {
      const { data } = await db.from(c.table).select(`id, status, ${c.label}`).limit(5000);
      const rows = z
        .array(z.object({ id: z.string(), status: z.string() }).catchall(z.unknown()))
        .catch([])
        .parse(data);
      const counts = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
      const review = rows
        .filter((r) => r.status === "in_review")
        .map((r) => ({ id: r.id, label: String(r[c.label] ?? r.id), href: `${c.path}/${r.id}` }));
      return { ...c, counts, review, total: rows.length };
    }),
  );
  const review = tables.flatMap((c) => c.review.map((r) => ({ ...r, table: c.table })));

  const { data: recentData } = await db
    .from("content_audit_log")
    .select("id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at")
    .not("actor_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(8);
  const recent = z
    .array(
      z.object({
        id: z.string(),
        actor_id: z.string(),
        entity_type: z.string(),
        entity_id: z.string(),
        action: z.enum(["insert", "update", "delete"]),
        before_json: z.record(z.string(), z.unknown()).nullable(),
        after_json: z.record(z.string(), z.unknown()).nullable(),
        created_at: z.string(),
      }),
    )
    .catch([])
    .parse(recentData);
  const names = await staffNames(
    db,
    recent.map((r) => r.actor_id),
  );
  const typeName = (type: string) =>
    (AUDIT_TYPES as readonly string[]).includes(type) ? t(`adminAudit.types.${type as AuditType}`) : type;

  return (
    <>
      <PageHeader title={t("admin.dashboard")} description={t("admin.welcome", { email: user.email ?? "" })} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>{t("admin.reviewQueue")}</CardTitle>
          {review.length ? (
            <ul className="mt-3 space-y-1">
              {review.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="text-accent hover:underline">
                    {r.label}
                  </Link>
                  <span className="text-fg-muted text-sm"> · {typeName(r.table)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted mt-3">{t("admin.reviewQueueEmpty")}</p>
          )}
        </Card>

        <Card>
          <CardTitle>{t("admin.contentStatus")}</CardTitle>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-fg-muted">
              <tr>
                <th className="py-1 font-medium" />
                {CONTENT_STATUSES.map((s) => (
                  <th key={s} className="py-1 text-right font-medium">
                    {t(`status.${s}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tables.map((c) => (
                <tr key={c.table} className="border-border border-t">
                  <th scope="row" className="py-1.5 font-medium">
                    <Link href={c.path} className="hover:text-accent">
                      {typeName(c.table)}
                    </Link>
                  </th>
                  {CONTENT_STATUSES.map((s) => (
                    <td key={s} className="py-1.5 text-right tabular-nums">
                      {c.counts[s] || "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between">
            <CardTitle>{t("admin.recentChanges")}</CardTitle>
            <Link href="/admin/audit" className="text-accent text-sm hover:underline">
              {t("admin.allChanges")}
            </Link>
          </div>
          {recent.length ? (
            <ul className="mt-3 space-y-2">
              {recent.map((r) => {
                const label = rowLabel(r.after_json) ?? rowLabel(r.before_json) ?? r.entity_id.slice(0, 8);
                const path = r.action !== "delete" ? adminPath(r.entity_type, r.entity_id) : null;
                return (
                  <li key={r.id} className="text-sm">
                    <span className="font-medium">{t(`adminAudit.actions.${r.action}`)}</span> ·{" "}
                    {typeName(r.entity_type)} ·{" "}
                    {path ? (
                      <Link href={path} className="text-accent hover:underline">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                    <span className="text-fg-muted block text-xs">
                      {format.dateTime(new Date(r.created_at), { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                      {t("adminAudit.by", { name: names.get(r.actor_id) ?? "—" })}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-fg-muted mt-3">{t("adminCommon.noItems")}</p>
          )}
        </Card>

        <Card>
          <CardTitle>{t("admin.yourRoles")}</CardTitle>
          <ul className="mt-3 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <li key={role} className="bg-accent-soft text-accent rounded-full px-3 py-1 text-sm font-medium">
                {t(`roles.${role}`)}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
