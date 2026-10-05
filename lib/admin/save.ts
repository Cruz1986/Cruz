import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { isPublisher, isStaff } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { routing } from "@/lib/i18n/routing";
import { allowedStatuses, dbErrorStatus, fieldErrors, type AdminFormState, type ContentStatus } from "./fields";

type Db = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type WriteResult = { data: { id: string } | null; error: { code?: string; message?: string } | null };

export function formLocale(formData: FormData) {
  return z.enum(routing.locales).catch(routing.defaultLocale).parse(formData.get("locale"));
}

/** Revalidates paths (given without the locale prefix) in every language; "*" revalidates every page. */
export function revalidateAll(paths: string[]) {
  if (paths.includes("*")) return revalidatePath("/", "layout");
  for (const locale of routing.locales)
    for (const path of paths) revalidatePath(`/${locale}${path === "/" ? "" : path}`);
}

/**
 * The common save flow of admin forms: check the role, validate, check the chosen status, write as the
 * signed-in user (row level security applies again), map database errors, revalidate, and open a newly
 * created item.
 */
export async function adminSave<T extends Record<string, unknown>>({
  formData,
  schema,
  role = "staff",
  write,
  revalidate,
  created,
}: {
  formData: FormData;
  schema: z.ZodType<T>;
  role?: "staff" | "publisher";
  write: (db: Db, data: T, user: SessionUser) => PromiseLike<WriteResult>;
  revalidate: (data: T) => string[];
  /** Admin path (without locale) to open after creating an item. */
  created?: (id: string) => string;
}): Promise<AdminFormState> {
  const user = await getSessionUser();
  if (!user || !(role === "publisher" ? isPublisher(user.roles) : isStaff(user.roles))) return { status: "forbidden" };

  const raw = Object.fromEntries([...formData.keys()].map((k) => [k, formData.get(k)]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", fieldErrors: fieldErrors(parsed.error) };
  const data = parsed.data;
  if (typeof data.status === "string" && !allowedStatuses(user.roles).includes(data.status as ContentStatus))
    return { status: "forbidden" };

  const db = await createSupabaseServerClient();
  if (!db) return { status: "failed" };
  const result = await write(db, data, user);
  if (result.error) return { status: dbErrorStatus(result.error) };
  // An update that matched no row means RLS hid it (e.g. an editor editing published content).
  if (!result.data) return { status: "forbidden" };

  revalidateAll(revalidate(data));
  if (created && !data.id) redirect(`/${formLocale(formData)}${created(result.data.id)}`);
  return { status: "saved" };
}

/** Deletes a row (publishers), then returns to `back`. */
export async function adminDelete(formData: FormData, table: string, back: string, revalidate: string[]) {
  const user = await getSessionUser();
  const locale = formLocale(formData);
  const id = z.uuid().safeParse(formData.get("id"));
  if (user && isPublisher(user.roles) && id.success) {
    const db = await createSupabaseServerClient();
    const { data } = (await db?.from(table).delete().eq("id", id.data).select("id").maybeSingle()) ?? {};
    if (data) revalidateAll(revalidate);
  }
  redirect(`/${locale}${back}`);
}
