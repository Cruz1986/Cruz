/** Helpers for the change history (content_audit_log), pure and unit tested. */

export const AUDIT_TYPES = [
  "prayers",
  "saints",
  "reflections",
  "rosary_mysteries",
  "media",
  "content_sources",
  "bible_translations",
  "bible_books",
  "celebrations",
  "liturgical_days",
  "lectionary_readings",
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

const IGNORED = new Set(["updated_at", "created_at", "updated_by", "created_by", "search_norm", "generated_at"]);

export type FieldChange = { field: string; before: unknown; after: unknown };

/** The fields that differ between two row snapshots (bookkeeping columns left out). */
export function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: FieldChange[] = [];
  for (const field of [...keys].sort()) {
    if (IGNORED.has(field) || field === "id") continue;
    const a = before?.[field] ?? null;
    const b = after?.[field] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ field, before: a, after: b });
  }
  return changes;
}

/** A short readable value for the change list. */
export function displayValue(value: unknown, max = 160): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A name for the changed row, from whichever naming column it has. */
export function rowLabel(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  for (const key of [
    "title_en",
    "name_en",
    "title",
    "name",
    "title_ta",
    "name_ta",
    "code",
    "slug",
    "date",
    "reference_display",
  ]) {
    const value = row[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/** Admin page of a changed row, when there is one. */
export function adminPath(type: string, id: string): string | null {
  const base: Partial<Record<string, string>> = {
    prayers: "/admin/prayers",
    saints: "/admin/saints",
    reflections: "/admin/reflections",
    rosary_mysteries: "/admin/rosary",
    media: "/admin/media",
    content_sources: "/admin/sources",
    celebrations: "/admin/calendar/celebrations",
  };
  return base[type] ? `${base[type]}/${id}` : null;
}
