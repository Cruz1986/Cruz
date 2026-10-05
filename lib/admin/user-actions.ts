"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canManageUsers } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { routing } from "@/lib/i18n/routing";

export type RoleChangeState = {
  status: "idle" | "saved" | "forbidden" | "last_super_admin" | "invalid" | "failed";
};

const schema = z.object({
  userId: z.uuid(),
  role: z.enum(["super_admin", "content_admin", "editor"]), // the base `user` role is not managed here
  intent: z.enum(["grant", "revoke"]),
  locale: z.enum(routing.locales),
});

/**
 * Grants or revokes a staff role. Authorised here (super admins only) and again by row
 * level security, since the query runs with the caller's own session.
 */
export async function changeUserRole(_prev: RoleChangeState, formData: FormData): Promise<RoleChangeState> {
  const actor = await getSessionUser();
  if (!actor || !canManageUsers(actor.roles)) return { status: "forbidden" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid" };
  const { userId, role, intent, locale } = parsed.data;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "failed" };

  const { data: roleRow, error: roleError } = await supabase.from("roles").select("id").eq("key", role).single();
  if (roleError || !roleRow) return { status: "failed" };

  const { error } =
    intent === "grant"
      ? await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role_id: roleRow.id, granted_by: actor.id }, { ignoreDuplicates: true })
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role_id", roleRow.id);

  if (error) return { status: error.code === "23514" ? "last_super_admin" : "failed" };

  revalidatePath(`/${locale}/admin/users`);
  return { status: "saved" };
}
