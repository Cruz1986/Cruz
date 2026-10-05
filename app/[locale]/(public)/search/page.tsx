import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, CalendarDays, Flower2, HandHeart, NotebookText, Search, Users } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { siteSearch, type ContentHit, type ContentKind } from "@/lib/content/search";
import { publicBible } from "@/lib/content/public-bible";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { todayIn, toIso } from "@/lib/liturgy/plain-date";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonClasses } from "@/components/ui/button";
import { Highlighted } from "@/components/ui/highlighted";
import { bookAbbr } from "@/components/bible/book-name";
import { formatLongDate } from "@/components/today/day-header";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.search");
  return { title: t("title"), robots: { index: false } };
}

const SECTIONS: {
  kind: ContentKind;
  label: "prayers" | "saints" | "rosary" | "reflections" | "celebrations";
  icon: typeof Search;
}[] = [
  { kind: "celebration", label: "celebrations", icon: CalendarDays },
  { kind: "prayer", label: "prayers", icon: HandHeart },
  { kind: "saint", label: "saints", icon: Users },
  { kind: "mystery", label: "rosary", icon: Flower2 },
  { kind: "reflection", label: "reflections", icon: NotebookText },
];

function href(hit: ContentHit): string {
  switch (hit.kind) {
    case "prayer":
      return `/prayers/${hit.key}`;
    case "saint":
      return `/saints/${hit.key}`;
    case "mystery":
      return `/rosary/${hit.key.split("/")[0]}`;
    case "reflection":
      return `/today/${hit.key}`;
    default:
      return hit.nextDate ? `/today/${hit.nextDate}` : "/calendar";
  }
}

export default async function SearchPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations();
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 100);
  const results = q ? await siteSearch(q, locale, toIso(todayIn(DEFAULT_TIME_ZONE))) : null;
  const books = results?.translation ? await publicBible.books(results.translation.code) : [];
  const abbr = new Map(books.map((b) => [b.code, bookAbbr(b, locale)]));
  const title = (h: { titleEn: string | null; titleTa: string | null }) =>
    (locale === "ta" ? (h.titleTa ?? h.titleEn) : (h.titleEn ?? h.titleTa)) ?? "";
  const total =
    (results?.reference ? 1 : 0) +
    (results?.verses.length ?? 0) +
    (results?.content.length ?? 0) +
    (results?.passageDays.length ?? 0);

  const section = (id: string, label: string, icon: ReactNode, children: ReactNode, more?: ReactNode) => (
    <section aria-labelledby={id} className="border-border bg-surface rounded-2xl border p-4">
      <h2 id={id} className="mb-2 flex items-center gap-2 font-semibold">
        {icon}
        {label}
      </h2>
      {children}
      {more}
    </section>
  );

  return (
    <>
      <PageHeader title={t("pages.search.title")} description={t("pages.search.description")} />
      <form role="search" className="mb-6 flex max-w-2xl gap-2">
        <label htmlFor="q" className="sr-only">
          {t("search.label")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("search.placeholder")}
          className="border-border bg-surface focus:border-accent min-h-12 flex-1 rounded-xl border px-3"
        />
        <Button type="submit">
          <Search aria-hidden className="size-4" />
          <span className="sr-only sm:not-sr-only">{t("search.submit")}</span>
        </Button>
      </form>

      {!q ? (
        <p className="text-fg-muted max-w-2xl">{t("search.hint")}</p>
      ) : !results?.words.length ? (
        <p className="text-fg-muted">{t("search.tooShort")}</p>
      ) : total === 0 ? (
        <EmptyState icon={Search} title={t("search.none", { query: q })} body={t("search.hint")} />
      ) : (
        <div className="space-y-4">
          <p role="status" className="text-fg-muted text-sm">
            {t("search.results", { count: total })}
          </p>

          {results.reference ? (
            <Link
              href={results.reference.href}
              className="border-accent/30 bg-accent-soft hover:border-accent flex items-center gap-3 rounded-2xl border p-4"
            >
              <BookOpen aria-hidden className="text-accent size-5" />
              <span className="flex-1 font-semibold">
                {t("search.goTo", {
                  reference: `${abbr.get(results.reference.book) ?? results.reference.book} ${results.reference.chapter}${
                    results.reference.verse
                      ? `:${results.reference.verse}${results.reference.verseEnd ? `-${results.reference.verseEnd}` : ""}`
                      : ""
                  }`,
                })}
              </span>
              <ArrowRight aria-hidden className="text-accent size-4" />
            </Link>
          ) : null}

          {results.passageDays.length
            ? section(
                "mass",
                t("search.readAtMass"),
                <CalendarDays aria-hidden className="text-gold size-5" />,
                <ul className="divide-border divide-y">
                  {results.passageDays.map((d) => (
                    <li key={d.date}>
                      <Link href={`/today/${d.date}`} className="hover:bg-surface-muted block rounded-lg px-2 py-2">
                        <span className="text-fg block font-medium">{formatLongDate(d.date, locale)}</span>
                        <span className="text-fg-muted block text-sm">
                          {locale === "ta" ? d.titleTa : d.titleEn} ·{" "}
                          {t(`today.reading.${d.readingType}` as "today.reading.gospel")} ·{" "}
                          <span lang="ta">{d.reference}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>,
              )
            : null}

          {results.verses.length && results.translation
            ? section(
                "bible",
                `${t("search.bible")} · ${results.translation.shortName}`,
                <BookOpen aria-hidden className="text-accent size-5" />,
                <ul className="divide-border divide-y">
                  {results.verses.map((v) => (
                    <li key={v.sortKey}>
                      <Link
                        href={`/bible/${results.translation!.code}/${v.book.toLowerCase()}/${v.chapter}#v${v.verse}`}
                        className="hover:bg-surface-muted block rounded-lg px-2 py-2"
                      >
                        <span className="text-accent block text-sm font-semibold">
                          {abbr.get(v.book) ?? v.book} {v.chapter}:{v.label}
                        </span>
                        <span
                          lang={results.translation!.language}
                          className="reading text-fg block max-w-none text-base"
                        >
                          <Highlighted text={v.text} words={results.words} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>,
                <Link
                  href={`/bible/search?q=${encodeURIComponent(q)}&t=${results.translation.code}`}
                  className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3" })}
                >
                  {t("search.moreBible")}
                </Link>,
              )
            : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {SECTIONS.map(({ kind, label, icon: Icon }) => {
              const hits = results.content.filter((h) => h.kind === kind);
              return hits.length ? (
                <Fragment key={kind}>
                  {section(
                    `s-${kind}`,
                    t(`search.${label}`),
                    <Icon aria-hidden className="text-accent size-5" />,
                    <ul className="divide-border divide-y">
                      {hits.map((h) => (
                        <li key={`${h.kind}:${h.key}:${h.language ?? ""}`}>
                          <Link href={href(h)} className="hover:bg-surface-muted block rounded-lg px-2 py-2">
                            <span lang={h.language ?? undefined} className="text-fg block font-medium">
                              <Highlighted text={title(h)} words={results.words} />
                            </span>
                            {h.kind === "celebration" && h.nextDate ? (
                              <span className="text-fg-muted block text-sm">
                                {t("search.next", { date: formatLongDate(h.nextDate, locale) })}
                              </span>
                            ) : null}
                            {h.kind === "reflection" ? (
                              <span className="text-fg-muted block text-sm">{formatLongDate(h.key, locale)}</span>
                            ) : null}
                            {h.snippet ? (
                              <span className="text-fg-muted block text-sm">
                                <Highlighted text={h.snippet} words={results.words} />
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>,
                  )}
                </Fragment>
              ) : null;
            })}
          </div>
        </div>
      )}
    </>
  );
}
