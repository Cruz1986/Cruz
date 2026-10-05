import { getTranslations } from "next-intl/server";
import { ChevronRight, Info, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { PageHeader } from "@/components/ui/page-header";
import { MORE_NAV } from "@/components/layout/nav-items";

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "more");
}

export default async function MorePage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations();
  const items = [
    ...MORE_NAV.map(({ key, href, icon }) => ({ key, href, icon, label: t(`nav.${key}`) })),
    { key: "account", href: "/login", icon: UserRound, label: t("nav.account") },
    { key: "credits", href: "/credits", icon: Info, label: t("nav.credits") },
    { key: "privacy", href: "/privacy", icon: ShieldCheck, label: t("nav.privacy") },
  ];

  return (
    <>
      <PageHeader title={t("pages.more.title")} description={t("pages.more.description")} />
      <ul className="divide-border border-border bg-surface divide-y overflow-hidden rounded-2xl border">
        {items.map(({ key, href, icon: Icon, label }) => (
          <li key={key}>
            <Link href={href} className="text-fg hover:bg-surface-muted flex min-h-14 items-center gap-3 px-4">
              <Icon aria-hidden className="text-fg-muted size-5" />
              <span className="flex-1">{label}</span>
              <ChevronRight aria-hidden className="text-fg-muted size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
