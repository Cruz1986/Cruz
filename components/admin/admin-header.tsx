import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { canManageUsers, type RoleKey } from "@/lib/auth/roles";
import { NavLink } from "@/components/layout/nav-link";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";

/** Admin navigation. Display only: every admin page and action enforces access itself. */
export async function AdminHeader({ roles }: { roles: readonly RoleKey[] }) {
  const t = await getTranslations();
  const items = [
    { href: "/admin", label: t("admin.dashboard") },
    ...(canManageUsers(roles) ? [{ href: "/admin/users", label: t("admin.users") }] : []),
  ];

  return (
    <header className="border-border bg-surface border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="text-fg-muted hover:text-fg inline-flex items-center gap-1 text-sm">
          <ArrowLeft aria-hidden className="size-4" />
          {t("admin.backToSite")}
        </Link>
        <p className="text-fg mr-auto font-semibold">{t("admin.title")}</p>
        <LanguageSwitcher />
        <SignOutButton size="sm" />
      </div>
      <nav aria-label={t("admin.title")} className="mx-auto max-w-6xl px-4">
        <ul className="flex gap-1 overflow-x-auto">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                href={item.href}
                exact={item.href === "/admin"}
                className="inline-block border-b-2 px-3 py-2 text-sm font-medium"
                activeClassName="border-accent text-accent"
                inactiveClassName="border-transparent text-fg-muted hover:text-fg"
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
