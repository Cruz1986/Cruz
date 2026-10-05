"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { isActive } from "./nav-items";

export function NavLink({
  href,
  exact = false,
  className,
  activeClassName,
  inactiveClassName,
  children,
}: {
  href: string;
  /** Match only this exact path (for section roots that have child pages). */
  exact?: boolean;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  );
}
