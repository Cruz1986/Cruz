"use client";

import { useState } from "react";
import { Heart, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useFavoritePrayers } from "./favorites";

export type LibraryCategory = {
  slug: string;
  name: string;
  prayers: { slug: string; title: string; altTitle: string | null; searchText: string }[];
};

const normalize = (s: string) => s.normalize("NFC").toLowerCase().replace(/[​-‍]/g, "");

/** Category lists with instant search (titles in both languages) and device favourites. */
export function PrayerLibrary({ categories }: { categories: LibraryCategory[] }) {
  const t = useTranslations("prayers");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const { slugs: favorites } = useFavoritePrayers();
  const q = normalize(query.trim());

  const all = categories.flatMap((c) => c.prayers);
  // Titles first, then prayers whose text or category mentions the query.
  const score = (p: LibraryCategory["prayers"][number], category: string) =>
    !q
      ? 1
      : normalize(`${p.title} ${p.altTitle ?? ""}`).includes(q)
        ? 2
        : normalize(`${category} ${p.searchText}`).includes(q)
          ? 1
          : 0;
  const filtered = categories
    .map((c) => ({
      ...c,
      prayers: c.prayers
        .map((p) => ({ p, s: score(p, c.name) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.p),
    }))
    .filter((c) => c.prayers.length);
  const saved = favorites.flatMap((slug) => all.filter((p) => p.slug === slug));

  const item = (p: LibraryCategory["prayers"][number]) => (
    <li key={p.slug}>
      <Link href={`/prayers/${p.slug}`} className="text-fg hover:bg-surface-muted flex min-h-12 items-center px-4 py-2">
        <span>
          {p.title}
          {p.altTitle && p.altTitle !== p.title ? (
            <span className="text-fg-muted block text-sm" lang={locale === "ta" ? "en" : "ta"}>
              {p.altTitle}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="space-y-6">
      <div role="search" className="relative max-w-xl">
        <label htmlFor="prayer-search" className="sr-only">
          {t("search")}
        </label>
        <Search
          aria-hidden
          className="text-fg-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
        />
        <input
          id="prayer-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="border-border bg-surface text-fg min-h-11 w-full rounded-xl border pr-4 pl-10"
        />
      </div>

      {!q && saved.length ? (
        <section aria-labelledby="saved-prayers">
          <h2 id="saved-prayers" className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Heart aria-hidden className="text-lit-red size-4 fill-current" />
            {t("favorites")}
          </h2>
          <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">{saved.map(item)}</ul>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-fg-muted" role="status">
          {t("noResults", { q: query })}
        </p>
      ) : (
        filtered.map((c) => (
          <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
            <h2 id={`cat-${c.slug}`} className="mb-2 text-lg font-semibold">
              {c.name}
            </h2>
            <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
              {c.prayers.map(item)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
