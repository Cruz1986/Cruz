import { SectionPlaceholder } from "@/components/layout/section-placeholder";
import { initPage, pageMetadata, type LocaleParams } from "@/lib/i18n/page";

export function generateMetadata({ params }: LocaleParams) {
  return pageMetadata(params, "rosary");
}

export default async function RosaryPage({ params }: LocaleParams) {
  await initPage(params);
  return <SectionPlaceholder section="rosary" />;
}
