import "server-only";
import { z } from "zod";
import { mediaUrl } from "@/lib/content/saints";
import type { adminDb } from "./data";

export const mediaRowSchema = z.object({
  id: z.string(),
  storage_path: z.string(),
  mime_type: z.string(),
  bytes: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  alt_en: z.string().nullable(),
  alt_ta: z.string().nullable(),
  attribution_text: z.string().nullable(),
  source_id: z.string(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  updated_at: z.string(),
});
export type MediaRow = z.infer<typeof mediaRowSchema> & { url: string | null };

export async function listMedia(db: Awaited<ReturnType<typeof adminDb>>): Promise<MediaRow[]> {
  const { data, error } = await db
    .from("media")
    .select("*")
    .eq("kind", "image")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return z
    .array(mediaRowSchema)
    .parse(data)
    .map((m) => ({ ...m, url: mediaUrl(m.storage_path) }));
}
