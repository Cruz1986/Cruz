import { getTranslations } from "next-intl/server";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsPanel } from "@/components/preferences/settings-panel";
import { ReminderSettings } from "@/components/preferences/reminder-settings";

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "settings");
}

export default async function SettingsPage({ params }: LocaleParams) {
  await initPage(params);
  const t = await getTranslations("pages.settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="space-y-4">
        <SettingsPanel />
        <ReminderSettings />
      </div>
    </>
  );
}
