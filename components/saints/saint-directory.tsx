"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { saintName, saintTitle, searchSaints, type SaintSummary } from "@/lib/saints/helpers";

export type DirectorySaint = SaintSummary & { feastLabel: string | null };

/** Every saint by month of their feast, with instant search across names, titles and patronage. */
export function SaintDirectory({ saints, monthNames }: { saints: DirectorySaint[]; monthNames: string[] }) {
  const t = useTranslations("saints");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const results = searchSaints(saints, query);
  const searching = query.trim().length > 0;

  const months = monthNames
    .map((name, i) => ({ month: i + 1, name, saints: results.filter((s) => s.feastMonth === i + 1) }))
    .filter((m) => m.saints.length);

  const item = (s: DirectorySaint) => {
    const title = saintTitle(s, locale);
    return (
      <li key={s.slug}>
        <Link
          href={`/saints/${s.slug}`}
          className="hover:bg-surface-muted flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2"
        >
          <span>
            <span className="text-fg block font-medium">{saintName(s, locale)}</span>
            {title ? <span className="text-fg-muted block text-sm">{title}</span> : null}
          </span>
          {s.feastLabel ? <span className="text-fg-muted shrink-0 text-sm">{s.feastLabel}</span> : null}
        </Link>
      </li>
    );
  };

  return (
    <section aria-labelledby="all-saints" className="space-y-4">
      <h2 id="all-saints" className="text-lg font-semibold">
        {t("allSaints")}
      </h2>
      <div className="relative">
        <Search
          aria-hidden
          className="text-fg-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("search")}
          placeholder={t("searchPlaceholder")}
          className="border-border bg-surface focus:border-accent min-h-12 w-full rounded-xl border pr-3 pl-10"
        />
      </div>
      <p role="status" className="text-fg-muted text-sm">
        {searching && results.length === 0
          ? t("noResults", { query: query.trim() })
          : t("count", { count: results.length })}
      </p>

      {searching ? (
        <ul className="divide-border divide-y">{results.map(item)}</ul>
      ) : (
        <>
          <nav aria-label={t("months")} className="flex flex-wrap gap-2">
            {months.map((m) => (
              <a
                key={m.month}
                href={`#month-${m.month}`}
                className="border-border hover:bg-surface-muted inline-flex min-h-10 items-center rounded-full border px-4 text-sm"
              >
                {m.name}
              </a>
            ))}
          </nav>
          {months.map((m) => (
            <section
              key={m.month}
              id={`month-${m.month}`}
              aria-labelledby={`month-${m.month}-title`}
              className="scroll-mt-20"
            >
              <h3 id={`month-${m.month}-title`} className="text-gold mb-1 font-semibold">
                {m.name}
              </h3>
              <ul className="divide-border divide-y">{m.saints.map(item)}</ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
