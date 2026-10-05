import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { HEADER_NAV, NAV_ITEMS } from "./nav-items";
import { NavLink } from "./nav-link";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader() {
  const t = useTranslations();
  const SettingsIcon = NAV_ITEMS.settings.icon;
  const LibraryIcon = NAV_ITEMS.library.icon;

  return (
    <header className="border-border bg-bg/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="text-fg mr-auto flex min-w-0 items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
          <img src="/icon.svg" alt="" width={28} height={28} className="size-7 shrink-0" />
          <span className="truncate">{t("app.name")}</span>
        </Link>

        <nav aria-label={t("nav.main")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {HEADER_NAV.map((item) => (
              <li key={item.key}>
                <NavLink
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-medium"
                  activeClassName="bg-accent-soft text-accent"
                  inactiveClassName="text-fg-muted hover:text-fg"
                >
                  {t(`nav.${item.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/search"
          aria-label={t("nav.search")}
          className="text-fg-muted hover:bg-surface-muted hover:text-fg inline-flex size-10 shrink-0 items-center justify-center rounded-full"
        >
          <Search aria-hidden className="size-5" />
        </Link>
        <LanguageSwitcher />
        <Link
          href={NAV_ITEMS.library.href}
          aria-label={t("nav.library")}
          className="text-fg-muted hover:bg-surface-muted hover:text-fg hidden size-10 items-center justify-center rounded-full md:inline-flex"
        >
          <LibraryIcon aria-hidden className="size-5" />
        </Link>
        <Link
          href={NAV_ITEMS.settings.href}
          aria-label={t("nav.settings")}
          className="text-fg-muted hover:bg-surface-muted hover:text-fg hidden size-10 items-center justify-center rounded-full md:inline-flex"
        >
          <SettingsIcon aria-hidden className="size-5" />
        </Link>
      </div>
    </header>
  );
}
