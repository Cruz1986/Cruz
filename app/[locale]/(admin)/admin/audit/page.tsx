import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { adminDb, staffNames } from "@/lib/admin/data";
import { AUDIT_TYPES, adminPath, changedFields, displayValue, rowLabel } from "@/lib/admin/audit";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

const PAGE_SIZE = 40;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; action?: string; page?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminAudit");
  return { title: t("title"), robots: { index: false } };
}

const rowSchema = z.object({
  id: z.string(),
  actor_id: z.string().nullable(),
  entity_type: z.string(),
  entity_id: z.string(),
  action: z.enum(["insert", "update", "delete"]),
  before_json: z.record(z.string(), z.unknown()).nullable(),
  after_json: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});

export default async function AuditPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/audit` });
  const query = await searchParams;
  const type = AUDIT_TYPES.find((x) => x === query.type) ?? null;
  const action = (["insert", "update", "delete"] as const).find((x) => x === query.action) ?? null;
  const page = Math.max(0, Math.min(200, Number(query.page) || 0));
  const t = await getTranslations("adminAudit");
  const format = await getFormatter();
  const db = await adminDb();

  let request = db
    .from("content_audit_log")
    .select("id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at")
    .in("entity_type", type ? [type] : [...AUDIT_TYPES])
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (action) request = request.eq("action", action);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  const rows = z.array(rowSchema).parse(data);
  const more = rows.length > PAGE_SIZE;
  const shown = rows.slice(0, PAGE_SIZE);
  const names = await staffNames(
    db,
    shown.map((r) => r.actor_id),
  );
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (action) sp.set("action", action);
    if (p) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <form className="border-border bg-surface mb-4 flex flex-wrap items-end gap-3 rounded-2xl border p-4">
        <label className="text-sm font-medium">
          {t("type")}
          <select
            name="type"
            defaultValue={type ?? ""}
            className="border-border bg-surface mt-1 block rounded-xl border px-3 py-2"
          >
            <option value="">—</option>
            {AUDIT_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`types.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t("action")}
          <select
            name="action"
            defaultValue={action ?? ""}
            className="border-border bg-surface mt-1 block rounded-xl border px-3 py-2"
          >
            <option value="">—</option>
            {(["insert", "update", "delete"] as const).map((x) => (
              <option key={x} value={x}>
                {t(`actions.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClasses({ size: "sm", variant: "secondary" })}>
          {(await getTranslations("adminCommon"))("filter")}
        </button>
      </form>

      {shown.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ol className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {shown.map((r) => {
            const changes = changedFields(r.before_json, r.after_json);
            const label = rowLabel(r.after_json) ?? rowLabel(r.before_json) ?? r.entity_id.slice(0, 8);
            const path = r.action !== "delete" ? adminPath(r.entity_type, r.entity_id) : null;
            const typeLabel = AUDIT_TYPES.includes(r.entity_type as never)
              ? t(`types.${r.entity_type as (typeof AUDIT_TYPES)[number]}`)
              : r.entity_type;
            return (
              <li key={r.id} className="space-y-1 p-4">
                <p className="text-sm">
                  <span className="font-semibold">{t(`actions.${r.action}`)}</span> · {typeLabel} ·{" "}
                  {path ? (
                    <Link href={path} className="text-accent underline underline-offset-2">
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </p>
                <p className="text-fg-muted text-xs">
                  {format.dateTime(new Date(r.created_at), { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                  {r.actor_id ? t("by", { name: names.get(r.actor_id) ?? "—" }) : t("system")}
                </p>
                {r.action === "update" && changes.length ? (
                  <details className="text-sm">
                    <summary className="text-accent cursor-pointer">{t("details", { count: changes.length })}</summary>
                    <table className="mt-2 w-full table-fixed text-left text-xs">
                      <thead>
                        <tr className="text-fg-muted">
                          <th className="w-1/5 py-1">{t("field")}</th>
                          <th className="py-1">{t("before")}</th>
                          <th className="py-1">{t("after")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((c) => (
                          <tr key={c.field} className="border-border border-t align-top">
                            <td className="py-1 font-mono">{c.field}</td>
                            <td className="py-1 break-words">{displayValue(c.before)}</td>
                            <td className="py-1 break-words">{displayValue(c.after)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <nav className="mt-4 flex justify-between">
        {page > 0 ? (
          <Link href={href(page - 1)} className={buttonClasses({ size: "sm", variant: "secondary" })}>
            {t("newer")}
          </Link>
        ) : (
          <span />
        )}
        {more ? (
          <Link href={href(page + 1)} className={buttonClasses({ size: "sm", variant: "secondary" })}>
            {t("older")}
          </Link>
        ) : null}
      </nav>
    </>
  );
}
