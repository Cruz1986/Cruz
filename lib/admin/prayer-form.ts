import { z } from "zod";
import { isPublisher, type RoleKey } from "@/lib/auth/roles";
import { SLUG_PATTERN } from "@/lib/prayers/markup";

export const CONTENT_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Statuses a role may set (mirrors the database policies: editors never publish or archive). */
export function allowedStatuses(roles: readonly RoleKey[]): ContentStatus[] {
  return isPublisher(roles) ? [...CONTENT_STATUSES] : ["draft", "in_review"];
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const prayerFormSchema = z
  .object({
    id: z.uuid().optional(),
    slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN).max(80),
    categoryId: z.uuid(),
    sourceId: z.uuid(),
    sortOrder: z.coerce.number().int().min(0).max(999),
    status: z.enum(CONTENT_STATUSES),
    titleEn: optionalText(200),
    bodyEn: optionalText(20_000),
    titleTa: optionalText(200),
    bodyTa: optionalText(20_000),
  })
  .refine((p) => (p.titleEn && p.bodyEn) || (p.titleTa && p.bodyTa), {
    message: "language_required",
    path: ["titleEn"],
  })
  .refine((p) => Boolean(p.titleEn) === Boolean(p.bodyEn) && Boolean(p.titleTa) === Boolean(p.bodyTa), {
    message: "title_and_text_together",
    path: ["titleTa"],
  });

export type PrayerFormValues = z.infer<typeof prayerFormSchema>;

export function parsePrayerForm(formData: FormData) {
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  return prayerFormSchema.safeParse({
    id: field("id") || undefined,
    slug: field("slug"),
    categoryId: field("categoryId"),
    sourceId: field("sourceId"),
    sortOrder: field("sortOrder") ?? "0",
    status: field("status"),
    titleEn: field("titleEn") ?? "",
    bodyEn: field("bodyEn") ?? "",
    titleTa: field("titleTa") ?? "",
    bodyTa: field("bodyTa") ?? "",
  });
}

/** Maps database errors to form messages. */
export function prayerErrorCode(
  code: string | undefined,
): "slug_taken" | "source_not_cleared" | "forbidden" | "failed" {
  if (code === "23505") return "slug_taken";
  if (code === "23514") return "source_not_cleared";
  if (code === "42501") return "forbidden";
  return "failed";
}
