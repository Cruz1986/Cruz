/** Rules for uploaded images (client and server; unit tested). */
import { z } from "zod";

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MEDIA_BUCKET = "media";

/** Storage path for a new image: images/<year>/<random id>.<ext>. */
export function imagePath(type: ImageType, id: string, now = new Date()): string {
  return `images/${now.getUTCFullYear()}/${id}.${IMAGE_TYPES[type]}`;
}

export const STORAGE_PATH = /^images\/\d{4}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

/** Why a file can't be uploaded, or null when it can. */
export function imageProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!(file.type in IMAGE_TYPES)) return "type";
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return "size";
  return null;
}

export const mediaRecordSchema = z
  .object({
    storagePath: z.string().regex(STORAGE_PATH),
    mimeType: z.enum(Object.keys(IMAGE_TYPES) as [ImageType, ...ImageType[]]),
    bytes: z.coerce.number().int().min(1).max(MAX_IMAGE_BYTES),
    width: z.coerce.number().int().min(1).max(20_000),
    height: z.coerce.number().int().min(1).max(20_000),
  })
  .refine((m) => m.storagePath.endsWith(`.${IMAGE_TYPES[m.mimeType]}`), {
    message: "type_mismatch",
    path: ["storagePath"],
  });
