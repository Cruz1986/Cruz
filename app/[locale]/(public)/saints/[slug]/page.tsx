import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookOpenText, CalendarDays, HandHeart } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { publicSaints } from "@/lib/content/saints";
import { publicBible } from "@/lib/content/public-bible";
import { prayerTitle } from "@/lib/content/prayers";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { FavoriteButton, NoteButton, NoteView, RecordVisit } from "@/components/personal/item-actions";
import { excerpt, feastLabel, lifeSpan, nextFeastDate, saintName, saintTitle } from "@/lib/saints/helpers";

export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const saint = await publicSaints.bySlug(slug);
  if (!saint) return {};
  const bio = (locale === "ta" ? (saint.biographyTa ?? saint.biographyEn) : saint.biographyEn) ?? "";
  return { title: saintName(saint, locale), description: excerpt(bio, 160) };
}

export default async function SaintPage({ params }: Props) {
  const locale = await initPage(params);
  const { slug } = await params;
  const saint = await publicSaints.bySlug(slug);
  if (!saint) notFound();
  const t = await getTranslations("saints");
  const [all, attribution] = await Promise.all([publicSaints.list(), publicBible.attribution(saint.sourceId)]);

  const name = saintName(saint, locale);
  const title = saintTitle(saint, locale);
  const feast = feastLabel(saint.feastMonth, saint.feastDay, locale);
  const next =
    saint.feastMonth && saint.feastDay
      ? toIso(nextFeastDate(saint.feastMonth, saint.feastDay, todayIn(DEFAULT_TIME_ZONE)))
      : null;
  const years = lifeSpan(saint.birthYear, saint.deathYear);
  const patronage = locale === "ta" ? (saint.patronageTa ?? saint.patronageEn) : saint.patronageEn;
  const patronageLang = locale === "ta" && !saint.patronageTa ? "en" : locale;
  const bio = locale === "ta" ? (saint.biographyTa ?? saint.biographyEn) : saint.biographyEn;
  const bioLang = locale === "ta" && !saint.biographyTa ? "en" : locale;
  const sameDay = all.filter(
    (s) => s.slug !== saint.slug && s.feastMonth === saint.feastMonth && s.feastDay === saint.feastDay,
  );

  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {saint.image ? (
          <figure className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- images come from Supabase storage */}
            <img
              src={saint.image.url}
              alt={
                (locale === "ta"
                  ? (saint.image.altTa ?? saint.image.altEn)
                  : (saint.image.altEn ?? saint.image.altTa)) ?? ""
              }
              className="border-border h-56 w-44 rounded-2xl border object-cover"
            />
            {saint.image.attribution ? (
              <figcaption className="text-fg-muted mt-1 max-w-44 text-xs">
                {t("imageCredit", { attribution: saint.image.attribution })}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <div className="space-y-2">
          <Link href="/saints" className="text-gold text-sm font-medium hover:underline">
            {t("allSaints")}
          </Link>
          <h1 className="text-fg text-2xl font-bold sm:text-3xl">{name}</h1>
          {title ? <p className="text-fg-muted text-lg">{title}</p> : null}
          <ul className="text-fg-muted space-y-1 text-sm">
            {feast ? (
              <li className="flex items-center gap-2">
                <CalendarDays aria-hidden className="size-4" />
                {t("feast", { date: feast })}
              </li>
            ) : null}
            {years ? <li>{years}</li> : null}
            {patronage ? <li lang={patronageLang}>{t("patronage", { patronage })}</li> : null}
          </ul>
          {next && feast ? (
            <Link
              href={`/today/${next}`}
              className="text-accent inline-flex min-h-10 items-center gap-2 text-sm font-medium hover:underline"
            >
              <BookOpenText aria-hidden className="size-4" />
              {t("readingsOfFeast", { date: feast })}
            </Link>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <FavoriteButton type="saint" slug={saint.slug} />
            <NoteButton type="saint" slug={saint.slug} name={name} />
          </div>
          <RecordVisit type="saint" entityKey={saint.slug} title={name} />
        </div>
      </header>
      <NoteView type="saint" slug={saint.slug} />

      <section aria-labelledby="life" className="border-border bg-surface space-y-3 rounded-2xl border p-5">
        <h2 id="life" className="font-semibold">
          {t("biography")}
        </h2>
        {locale === "ta" && !saint.biographyTa && saint.biographyEn ? (
          <p className="bg-surface-muted text-fg-muted rounded-xl p-3 text-sm">{t("tamilPending")}</p>
        ) : null}
        {bio ? (
          bio.split(/\n{2,}/).map((paragraph, i) => (
            <p key={i} lang={bioLang} className="reading text-fg max-w-none">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="text-fg-muted">{t("biographyPending")}</p>
        )}
      </section>

      {saint.prayers.length ? (
        <section aria-labelledby="saint-prayers" className="space-y-2">
          <h2 id="saint-prayers" className="font-semibold">
            {t("prayers")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {saint.prayers.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/prayers/${p.slug}`}
                  className="border-border hover:bg-surface-muted inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm"
                >
                  <HandHeart aria-hidden className="size-4" />
                  {prayerTitle(p, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {attribution ? <p className="text-fg-muted text-sm">{t("source", { attribution })}</p> : null}

      {sameDay.length ? (
        <nav aria-labelledby="same-day" className="border-border border-t pt-4">
          <h2 id="same-day" className="mb-2 font-semibold">
            {t("sameDay")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {sameDay.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/saints/${s.slug}`}
                  className="border-border hover:bg-surface-muted inline-flex min-h-10 items-center rounded-full border px-4 text-sm"
                >
                  {saintName(s, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
