import { getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { publicCredits } from "@/lib/content/credits";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export const revalidate = 3600;

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "credits");
}

/** Every verified source of the texts shown, then the data and software the app is built on. */
export default async function CreditsPage({ params }: LocaleParams) {
  await initPage(params);
  const [t, licenses, credits] = await Promise.all([
    getTranslations("pages.credits"),
    getTranslations("adminSources.licenseTypes"),
    publicCredits(),
  ]);
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-4">
        <Card>
          <CardTitle>{t("textsTitle")}</CardTitle>
          {credits.length ? (
            <ul className="divide-border mt-2 divide-y">
              {credits.map((c) => (
                <li key={c.id} className="space-y-1 py-3">
                  <p className="font-medium" lang="en">
                    {c.name}
                  </p>
                  <p className="text-fg-muted text-sm">
                    {licenses(c.licenseType)}
                    {c.copyrightHolder ? ` · © ${c.copyrightHolder}` : null}
                  </p>
                  {c.attribution ? (
                    <p className="text-sm" lang="en">
                      {c.attribution}
                    </p>
                  ) : null}
                  {c.approval ? <p className="text-sm">{t("approval", { approval: c.approval })}</p> : null}
                  {c.licenseUrl ? (
                    <a
                      href={c.licenseUrl}
                      rel="noopener noreferrer"
                      className="text-accent inline-flex items-center gap-1 text-sm underline underline-offset-2"
                    >
                      {t("licenseLink")}
                      <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted mt-2">{t("empty")}</p>
          )}
        </Card>
        <Card>
          <CardTitle>{t("dataTitle")}</CardTitle>
          <ul className="mt-2 list-disc space-y-2 ps-5 text-sm">
            <li>{t("calendar")}</li>
            <li>{t("lectionary")}</li>
            <li>{t("images")}</li>
            <li>{t("fonts")}</li>
            <li>{t("icons")}</li>
          </ul>
        </Card>
        <p>
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            {t("privacy")}
          </Link>
        </p>
      </div>
    </>
  );
}
