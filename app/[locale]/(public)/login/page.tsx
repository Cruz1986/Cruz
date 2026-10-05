import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, pageMetadata } from "@/lib/i18n/page";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { safeNextPath } from "@/lib/auth/redirect";
import { isAuthConfigured } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { SignOutButton } from "@/components/auth/sign-out-button";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
};

const ERRORS = ["callback", "failed", "not_configured"] as const;

export function generateMetadata({ params }: Pick<Props, "params">) {
  return pageMetadata(params, "login");
}

export default async function LoginPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations("auth");
  const query = await searchParams;
  const next = safeNextPath(query.next, `/${locale}`);
  const error = ERRORS.find((e) => e === query.error);

  if (!isAuthConfigured()) {
    return (
      <>
        <PageHeader title={t("signInTitle")} />
        <EmptyState icon={Info} title={t("notConfigured")} />
      </>
    );
  }

  const user = await getSessionUser();
  if (user) {
    return (
      <>
        <PageHeader title={t("accountTitle")} />
        <Card className="max-w-md space-y-4">
          <p className="text-fg">{t("signedInAs", { email: user.email ?? "" })}</p>
          <div className="flex flex-wrap gap-3">
            {isStaff(user.roles) ? (
              <Link href="/admin" className={buttonClasses()}>
                {t("openAdmin")}
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("signInTitle")} description={t("signInDescription")} />
      <Card className="max-w-md">
        {error ? (
          <p role="alert" className="border-lit-red/40 text-lit-red mb-4 rounded-xl border p-3 text-sm">
            {t(`error.${error}`)}
          </p>
        ) : null}
        <SignInPanel next={next} />
      </Card>
    </>
  );
}
