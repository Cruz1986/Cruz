import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/server";

/** The signed-in staff member's database client (pages have already checked the role). */
export async function adminDb() {
  const db = await createSupabaseServerClient();
  if (!db) notFound();
  return db;
}

export const sourceRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  copyright_holder: z.string().nullable(),
  license_type: z.string(),
  permission_status: z.string(),
  attribution_text: z.string().nullable(),
  ecclesiastical_approval: z.string().nullable(),
  license_url: z.string().nullable(),
  notes: z.string().nullable(),
  reviewed_by: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  updated_at: z.string(),
});
export type SourceRow = z.infer<typeof sourceRowSchema>;

export async function listSources(db: Awaited<ReturnType<typeof adminDb>>): Promise<SourceRow[]> {
  const { data, error } = await db.from("content_sources").select("*").order("name");
  if (error) throw new Error(error.message);
  return z.array(sourceRowSchema).parse(data);
}

/** Display names of staff members (for "changed by"). */
export async function staffNames(db: Awaited<ReturnType<typeof adminDb>>, ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await db.rpc("staff_names", { p_ids: unique });
  return new Map(
    z
      .array(z.object({ id: z.string(), display_name: z.string() }))
      .catch([])
      .parse(data)
      .map((r) => [r.id, r.display_name]),
  );
}
