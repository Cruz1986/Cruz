import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Search, Users } from "lucide-react";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { USER_MANAGER_ROLES, isRoleKey, type RoleKey } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/db/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { RoleToggle } from "@/components/admin/role-toggle";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

const MANAGED_ROLES = ["editor", "content_admin", "super_admin"] as const satisfies readonly RoleKey[];
const PAGE_SIZE = 50;

const rowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  created_at: z.string(),
  disabled_at: z.string().nullable(),
  user_roles: z.array(z.object({ roles: z.object({ key: z.string() }).nullable() })),
});

/** Strips characters that have meaning inside a PostgREST `or=(...)` filter. */
function searchTerm(raw: unknown): string {
  return typeof raw === "string"
    ? raw
        .replace(/[,()*%\\:"']/g, " ")
        .trim()
        .slice(0, 100)
    : "";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("users"), robots: { index: false } };
}

export default async function AdminUsersPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const actor = await requireRoles(USER_MANAGER_ROLES, { locale, nextPath: `/${locale}/admin/users` });
  const t = await getTranslations();
  const format = await getFormatter();
  const q = searchTerm((await searchParams).q);

  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  let query = supabase
    .from("profiles")
    .select("id, email, display_name, created_at, disabled_at, user_roles(roles(key))")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (q) query = query.or(`email.ilike.*${q}*,display_name.ilike.*${q}*`);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  const users = z.array(rowSchema).parse(data);

  return (
    <>
      <PageHeader title={t("admin.users")} description={t("admin.usersDescription")} />

      <form role="search" className="mb-6 flex max-w-lg gap-2">
        <label htmlFor="q" className="sr-only">
          {t("admin.search")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("admin.search")}
          className="border-border bg-surface text-fg min-h-11 flex-1 rounded-xl border px-4"
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden className="size-4" />
          {t("admin.searchSubmit")}
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={Users} title={t("admin.noUsers")} />
      ) : (
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {users.map((user) => {
            const roles = user.user_roles.map((ur) => ur.roles?.key).filter(isRoleKey);
            return (
              <li key={user.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate font-medium">
                    {user.email ?? user.id} {user.id === actor.id ? t("admin.you") : null}
                  </p>
                  <p className="text-fg-muted text-sm">
                    {user.display_name ? `${user.display_name} · ` : null}
                    {t("admin.joined", { date: format.dateTime(new Date(user.created_at), { dateStyle: "medium" }) })}
                    {user.disabled_at ? ` · ${t("admin.disabled")}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MANAGED_ROLES.map((role) => (
                    <RoleToggle key={role} userId={user.id} role={role} granted={roles.includes(role)} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
