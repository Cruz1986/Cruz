import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient, type DbClient } from "@/lib/db/public";
import { buildSafe } from "./build-safe";

export type Reflection = {
  id: string;
  date: string;
  language: "ta" | "en";
  title: string;
  body: string;
  author: string;
  sourceId: string;
  status: "draft" | "in_review" | "published" | "archived";
  updatedAt: string;
};

const schema = z.object({
  id: z.string(),
  reflection_date: z.string(),
  language: z.enum(["ta", "en"]),
  title: z.string(),
  body: z.string(),
  author: z.string(),
  source_id: z.string(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  updated_at: z.string(),
});
const COLUMNS = "id, reflection_date, language, title, body, author, source_id, status, updated_at";

const toReflection = (r: z.infer<typeof schema>): Reflection => ({
  id: r.id,
  date: r.reflection_date,
  language: r.language,
  title: r.title,
  body: r.body,
  author: r.author,
  sourceId: r.source_id,
  status: r.status,
  updatedAt: r.updated_at,
});

/** Reflections visible to the client (published only for the public), newest date first. */
export async function listReflections(db: DbClient, { date, limit = 200 }: { date?: string; limit?: number } = {}) {
  let query = db
    .from("reflections")
    .select(COLUMNS)
    .order("reflection_date", { ascending: false })
    .order("language")
    .limit(limit);
  if (date) query = query.eq("reflection_date", date);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load reflections: ${error.message}`);
  return z.array(schema).parse(data).map(toReflection);
}

export async function getReflection(db: DbClient, id: string): Promise<Reflection | null> {
  const { data, error } = await db.from("reflections").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load reflection: ${error.message}`);
  return data ? toReflection(schema.parse(data)) : null;
}

/** The published reflections of a date (at most one per language). */
export const publicReflections = cache(async (date: string): Promise<Reflection[]> => {
  const db = createPublicClient();
  return db ? buildSafe(() => listReflections(db, { date }), []) : [];
});
