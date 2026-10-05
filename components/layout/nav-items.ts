import { BookOpen, CalendarDays, Ellipsis, Flower2, HandHeart, Home, Settings, Sun, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavKey = "home" | "today" | "bible" | "prayers" | "rosary" | "saints" | "calendar" | "more" | "settings";

export type NavItem = { key: NavKey; href: string; icon: LucideIcon };

export const NAV_ITEMS: Record<NavKey, NavItem> = {
  home: { key: "home", href: "/", icon: Home },
  today: { key: "today", href: "/today", icon: Sun },
  bible: { key: "bible", href: "/bible", icon: BookOpen },
  prayers: { key: "prayers", href: "/prayers", icon: HandHeart },
  rosary: { key: "rosary", href: "/rosary", icon: Flower2 },
  saints: { key: "saints", href: "/saints", icon: Users },
  calendar: { key: "calendar", href: "/calendar", icon: CalendarDays },
  more: { key: "more", href: "/more", icon: Ellipsis },
  settings: { key: "settings", href: "/settings", icon: Settings },
};

/** Mobile bottom navigation (PRD §11). */
export const BOTTOM_NAV: NavItem[] = [
  NAV_ITEMS.home,
  NAV_ITEMS.bible,
  NAV_ITEMS.today,
  NAV_ITEMS.prayers,
  NAV_ITEMS.more,
];

/** Desktop header navigation. */
export const HEADER_NAV: NavItem[] = [
  NAV_ITEMS.today,
  NAV_ITEMS.bible,
  NAV_ITEMS.prayers,
  NAV_ITEMS.rosary,
  NAV_ITEMS.saints,
  NAV_ITEMS.calendar,
];

/** Secondary destinations listed on the More page. */
export const MORE_NAV: NavItem[] = [NAV_ITEMS.rosary, NAV_ITEMS.saints, NAV_ITEMS.calendar, NAV_ITEMS.settings];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
