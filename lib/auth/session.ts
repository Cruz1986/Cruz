import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { isRoleKey, hasAnyRole, type RoleKey } from "./roles";
import { loginPath } from "./redirect";

export type SessionUser = { id: string; email: string | null; roles: RoleKey[] };

/**
 * The signed-in user, verified with the Auth server, plus their effective roles from the
 * database. Memoised per request. Null when signed out or when auth is not configured.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: roleData, error: roleError } = await supabase.rpc("current_user_roles");
  const roles = !roleError && Array.isArray(roleData) ? roleData.filter(isRoleKey) : [];

  return { id: data.user.id, email: data.user.email ?? null, roles };
});

/** Signed-in user or redirect to login (returning to `nextPath`). */
export async function requireUser(locale: string, nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPath(locale, nextPath));
  return user;
}

/**
 * Signed-in user holding one of `allowed`. Signed-out users go to login; signed-in users
 * without the role get a 404 so the admin area is not revealed.
 */
export async function requireRoles(
  allowed: readonly RoleKey[],
  { locale, nextPath }: { locale: string; nextPath: string },
): Promise<SessionUser> {
  const user = await requireUser(locale, nextPath);
  if (!hasAnyRole(user.roles, allowed)) notFound();
  return user;
}
