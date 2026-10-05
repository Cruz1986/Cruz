import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Search } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { createPublicClient } from "@/lib/db/public";
import { searchBible, type SearchHit } from "@/lib/content/bible";
import { defaultTranslation, publicBible } from "@/lib/content/public-bible";
import { buildAliasIndex, parseReference } from "@/lib/bible/reference";
import { biblePath } from "@/lib/bible/paths";
import { normalizeText } from "@/lib/bible/text";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonClasses } from "@/components/ui/button";
import { bookAbbr } from "@/components/bible/book-name";
import { Highlighted } from "@/components/ui/highlighted";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[]; t?: string | string[]; after?: string | string[] }>;
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bible");
  return { title: t("search"), robots: { index: false } };
}

export default async function BibleSearchPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const t = await getTranslations("bible");
  const query = await searchParams;
  const q = one(query.q).trim().slice(0, 100);
  const after = Number(one(query.after)) || 0;

  const translations = await publicBible.translations();
  const current = translations.find((tr) => tr.code === one(query.t)) ?? defaultTranslation(translations, locale);
  if (!current) return <EmptyState icon={Search} title={t("unavailable")} body={t("unavailableBody")} />;

  const db = createPublicClient();
  const [books, aliases] = await Promise.all([publicBible.books(current.code), publicBible.aliases()]);
  const reference = q ? parseReference(q, buildAliasIndex(aliases)) : null;
  const referenceBook = reference && books.find((b) => b.code === reference.book);
  const words = normalizeText(q)
    .split(" ")
    .filter((w) => w.length >= 2);
  const results = db && words.length && !referenceBook ? await searchBible(db, current.code, q, after) : null;
  const abbr = new Map(books.map((b) => [b.code, bookAbbr(b, locale)]));

  return (
    <>
      <PageHeader title={t("search")} />
      <form role="search" className="mb-6 space-y-3">
        <label htmlFor="q" className="block font-medium">
          {t("searchLabel")}
        </label>
        <div className="flex max-w-xl gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            maxLength={100}
            className="border-border bg-surface text-fg min-h-11 min-w-0 flex-1 rounded-xl border px-4"
          />
          <Button type="submit">
            <Search aria-hidden className="size-4" />
            {t("searchSubmit")}
          </Button>
        </div>
        {translations.length > 1 ? (
          <fieldset className="flex flex-wrap items-center gap-3 text-sm">
            <legend className="sr-only">{t("searchIn")}</legend>
            {translations.map((tr) => (
              <label key={tr.code} className="inline-flex items-center gap-2" lang={tr.language}>
                <input type="radio" name="t" value={tr.code} defaultChecked={tr.code === current.code} />
                {tr.shortName}
              </label>
            ))}
          </fieldset>
        ) : (
          <input type="hidden" name="t" value={current.code} />
        )}
      </form>

      {q && !words.length && !referenceBook ? <p className="text-fg-muted">{t("searchHint")}</p> : null}

      {referenceBook && reference ? (
        <Link
          href={biblePath(current.code, reference.book, reference.chapter, reference.verse)}
          className={buttonClasses({ className: "mb-6" })}
        >
          {t("goToReference", {
            reference: `${bookAbbr(referenceBook, locale)} ${reference.chapter}${reference.verse ? `:${reference.verse}` : ""}`,
          })}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}

      {results ? (
        results.hits.length === 0 && !after ? (
          <p className="text-fg-muted">{t("noResults", { q })}</p>
        ) : (
          <>
            <ol
              aria-label={t("results")}
              className="divide-border border-border bg-surface divide-y rounded-2xl border"
              lang={current.language}
            >
              {results.hits.map((hit: SearchHit) => (
                <li key={hit.sortKey}>
                  <Link
                    href={biblePath(current.code, hit.book, hit.chapter, hit.verse)}
                    className="hover:bg-surface-muted block p-4"
                  >
                    <span className="text-accent mb-1 block font-sans text-sm font-semibold">
                      {abbr.get(hit.book) ?? hit.book} {hit.chapter}:{hit.label}
                    </span>
                    <span className="reading block max-w-none text-base">
                      <Highlighted text={hit.text} words={words} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {results.nextAfter ? (
              <Link
                href={`/bible/search?${new URLSearchParams({ q, t: current.code, after: String(results.nextAfter) })}`}
                className={buttonClasses({ variant: "secondary", className: "mt-4" })}
              >
                {t("moreResults")}
              </Link>
            ) : null}
          </>
        )
      ) : null}
    </>
  );
}
