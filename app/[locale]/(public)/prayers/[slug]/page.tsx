import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { prayerTitle, publicPrayers } from "@/lib/content/prayers";
import { publicBible } from "@/lib/content/public-bible";
import { prayerPlainText } from "@/lib/prayers/markup";
import { PrayerText } from "@/components/prayers/prayer-text";
import { PrayerActions } from "@/components/prayers/prayer-actions";
import { NoteButton, NoteView, RecordVisit } from "@/components/personal/item-actions";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const prayer = await publicPrayers.bySlug(slug);
  if (!prayer) return {};
  const body = (locale === "ta" ? (prayer.bodyTa ?? prayer.bodyEn) : (prayer.bodyEn ?? prayer.bodyTa)) ?? "";
  return { title: prayerTitle(prayer, locale), description: prayerPlainText(body).replace(/\n+/g, " ").slice(0, 160) };
}

export default async function PrayerPage({ params }: Props) {
  const locale = await initPage(params);
  const { slug } = await params;
  const prayer = await publicPrayers.bySlug(slug);
  if (!prayer) notFound();
  const t = await getTranslations("prayers");
  const [categories, all, attribution] = await Promise.all([
    publicPrayers.categories(),
    publicPrayers.list(),
    publicBible.attribution(prayer.sourceId),
  ]);
  const category = categories.find((c) => c.id === prayer.categoryId);
  const siblings = all.filter((p) => p.categoryId === prayer.categoryId && p.slug !== prayer.slug);

  // The reader's language first; the other language follows when it exists.
  const versions = [
    { lang: "ta", title: prayer.titleTa, body: prayer.bodyTa },
    { lang: "en", title: prayer.titleEn, body: prayer.bodyEn },
  ].sort((a, b) => (a.lang === locale ? -1 : b.lang === locale ? 1 : 0));
  const primary = versions.find((v) => v.body) ?? versions[0];
  const title = prayerTitle(prayer, locale);

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        {category ? (
          <Link href="/prayers" className="text-gold text-sm font-medium hover:underline">
            {locale === "ta" ? category.nameTa : category.nameEn}
          </Link>
        ) : null}
        <h1 className="text-fg text-2xl font-bold sm:text-3xl">{title}</h1>
        <div className="flex flex-wrap gap-2">
          <PrayerActions
            slug={prayer.slug}
            title={primary.title ?? title}
            plainText={prayerPlainText(primary.body ?? "")}
          />
          <NoteButton type="prayer" slug={prayer.slug} name={title} />
        </div>
        <RecordVisit type="prayer" entityKey={prayer.slug} title={title} />
      </header>
      <NoteView type="prayer" slug={prayer.slug} />

      {versions.map((v) =>
        v.body ? (
          <section
            key={v.lang}
            aria-label={v.lang === "ta" ? t("tamil") : t("english")}
            className="border-border bg-surface rounded-2xl border p-5"
          >
            {versions.filter((x) => x.body).length > 1 ? (
              <h2 className="text-fg-muted mb-3 text-sm font-semibold" lang={v.lang}>
                {v.lang === "ta" ? t("tamil") : t("english")}
                {v.title && v.title !== title ? ` · ${v.title}` : null}
              </h2>
            ) : null}
            <PrayerText text={v.body} language={v.lang} />
          </section>
        ) : (
          <p key={v.lang} className="bg-surface-muted text-fg-muted rounded-xl p-3 text-sm">
            {v.lang === "ta" ? t("tamilPending") : t("englishMissing")}
          </p>
        ),
      )}

      {attribution ? <p className="text-fg-muted text-sm">{t("source", { attribution })}</p> : null}

      {siblings.length && category ? (
        <nav aria-labelledby="more-prayers" className="border-border border-t pt-4">
          <h2 id="more-prayers" className="mb-2 font-semibold">
            {t("inCategory", { category: locale === "ta" ? category.nameTa : category.nameEn })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {siblings.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/prayers/${p.slug}`}
                  className="border-border hover:bg-surface-muted inline-flex min-h-10 items-center rounded-full border px-4 text-sm"
                >
                  {prayerTitle(p, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
