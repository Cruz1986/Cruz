import { useTranslations } from "next-intl";
import { BOTTOM_NAV } from "./nav-items";
import { NavLink } from "./nav-link";

export function BottomNav() {
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("main")}
      className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {BOTTOM_NAV.map(({ key, href, icon: Icon }) => (
          <li key={key}>
            <NavLink
              href={href}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[0.6875rem] leading-tight font-medium"
              activeClassName="text-accent"
              inactiveClassName="text-fg-muted hover:text-fg"
            >
              <Icon aria-hidden className="size-5" />
              <span className="max-w-full text-center [overflow-wrap:anywhere]">{t(key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
