/** Shared validation helpers for admin forms (client and server). */
import { z } from "zod";

export { CONTENT_STATUSES, allowedStatuses, type ContentStatus } from "./prayer-form";

export const LICENSE_TYPES = ["public_domain", "licensed", "permission_granted", "original", "unknown"] as const;
export const PERMISSION_STATUSES = ["verified", "pending", "restricted"] as const;

export const requiredText = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
export const optionalInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable());
export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .pipe(z.url({ protocol: /^https?$/ }).nullable());
export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

export type AdminFormState = {
  status: "idle" | "saved" | "invalid" | "conflict" | "source_not_cleared" | "rejected" | "forbidden" | "failed";
  fieldErrors?: Record<string, string>;
};

/** Form fields as strings ("" for missing ones), for zod schemas. */
export function formObject(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : ""];
    }),
  );
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return errors;
}

/** Maps database error codes to form results. */
export function dbErrorStatus(error: { code?: string; message?: string }): AdminFormState["status"] {
  const { code, message = "" } = error;
  if (code === "23505") return "conflict";
  if (code === "23514") return /content source/i.test(message) ? "source_not_cleared" : "rejected";
  if (code === "42501") return "forbidden";
  return "failed";
}
