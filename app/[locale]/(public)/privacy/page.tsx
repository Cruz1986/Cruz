import { getTranslations } from "next-intl/server";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "privacy");
}

const SECTIONS = ["noAccount", "account", "reminders", "notDone", "storage", "choices"] as const;

/** What the app stores, where, and how readers remove it. Keep in step with the code when data handling changes. */
export default async function PrivacyPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("pages.privacy");
  const contact = process.env.CONTACT_EMAIL;
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="max-w-2xl space-y-4">
        {SECTIONS.map((key) => (
          <Card key={key}>
            <CardTitle>{t(`${key}.title`)}</CardTitle>
            <p className="mt-2">{t(`${key}.body`)}</p>
          </Card>
        ))}
        {contact ? (
          <p>
            {t.rich("contact", {
              email: () => (
                <a href={`mailto:${contact}`} className="text-accent underline underline-offset-2">
                  {contact}
                </a>
              ),
            })}
          </p>
        ) : null}
      </div>
    </>
  );
}
