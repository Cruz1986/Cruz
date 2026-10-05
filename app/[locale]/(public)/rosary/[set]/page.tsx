import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { initPage } from "@/lib/i18n/page";
import { publicRosary } from "@/lib/content/rosary";
import { defaultTranslation, publicBible } from "@/lib/content/public-bible";
import { buildSequence, type MysterySetKey } from "@/lib/rosary/sequence";
import { buildAliasIndex, parseReference } from "@/lib/bible/reference";
import { biblePath } from "@/lib/bible/paths";
import { RosaryGuide } from "@/components/rosary/rosary-guide";

export const revalidate = 3600;
const SETS: MysterySetKey[] = ["joyful", "luminous", "sorrowful", "glorious"];
export function generateStaticParams() {
  return SETS.map((set) => ({ set }));
}
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; set: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, set } = await params;
  const data = await publicRosary();
  const found = data?.sets.find((s) => s.key === set);
  return found ? { title: locale === "ta" ? found.nameTa : found.nameEn } : {};
}

export default async function RosarySetPage({ params }: Props) {
  const locale = await initPage(params);
  const { set } = await params;
  const data = await publicRosary();
  const found = data?.sets.find((s) => s.key === set);
  if (!data || !found) notFound();
  const t = await getTranslations("rosary");

  // Link each mystery's Scripture reference to the Bible in the reader's language (when published).
  const [translations, aliases, attribution] = await Promise.all([
    publicBible.translations(),
    publicBible.aliases(),
    publicBible.attribution(data.mysteries[found.key][0].sourceId),
  ]);
  const translation = defaultTranslation(translations, locale);
  const index = buildAliasIndex(aliases);
  const scriptureLinks = data.mysteries[found.key].map((m) => {
    const ref = m.scripture ? parseReference(m.scripture, index) : null;
    return ref && translation ? biblePath(translation.code, ref.book, ref.chapter, ref.verse) : null;
  });
  const name = locale === "ta" ? found.nameTa : found.nameEn;

  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
      <RosaryGuide
        setKey={found.key}
        setName={name}
        positions={buildSequence(data.steps)}
        mysteries={data.mysteries[found.key]}
        prayers={data.prayers}
        scriptureLinks={scriptureLinks}
      />
      {attribution ? <p className="text-fg-muted text-sm">{t("source", { attribution })}</p> : null}
    </article>
  );
}
