"use client";

import type { ReactNode } from "react";
import { Bookmark, Cloud, CloudOff, Download, Heart, Highlighter, History, LogIn, NotebookPen, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { personal, usePersonalStore, useSyncState } from "@/lib/personal/client";
import { parseLocation, type Collection, type Store } from "@/lib/personal/store";
import { getSupabaseConfig } from "@/lib/env";
import { Button, buttonClasses } from "@/components/ui/button";

type Names = { en: string; ta: string };
export type LibraryLookups = {
  books: Record<string, Names>;
  translations: Record<string, string>;
  prayers: Record<string, Names>;
  saints: Record<string, Names>;
};

type Entry = { href: string; name: string; kind: "verse" | "chapter" | "prayer" | "saint" };

/** Everything the reader has saved, with links back to it. */
export function Library({ lookups }: { lookups: LibraryLookups }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const store = usePersonalStore();
  const { userId, status } = useSyncState();
  const pick = (n: Names | undefined, fallback: string) => (n ? (locale === "ta" ? n.ta : n.en) : fallback);

  const entry = (type: string, key: string, title?: string): Entry => {
    if (type === "prayer")
      return { kind: "prayer", href: `/prayers/${key}`, name: title ?? pick(lookups.prayers[key], key) };
    if (type === "saint")
      return { kind: "saint", href: `/saints/${key}`, name: title ?? pick(lookups.saints[key], key) };
    const loc = parseLocation(key);
    if (!loc) return { kind: "verse", href: "/bible", name: key };
    const book = pick(lookups.books[loc.book], loc.book);
    const version = lookups.translations[loc.translation] ?? loc.translation;
    const path = `/bible/${loc.translation}/${loc.book.toLowerCase()}/${loc.chapter}`;
    return loc.verse === null
      ? { kind: "chapter", href: path, name: title ?? `${book} ${loc.chapter} · ${version}` }
      : { kind: "verse", href: `${path}#v${loc.verse}`, name: `${book} ${loc.chapter}:${loc.verse} · ${version}` };
  };

  const when = (at: string) =>
    new Intl.DateTimeFormat(`${locale}-IN`, { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));

  function download() {
    const blob = new Blob([JSON.stringify({ ...store, owner: undefined }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-library.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const row = <C extends Collection>(
    key: string,
    collection: C,
    item: Store[C][number],
    e: Entry,
    extra?: ReactNode,
  ) => (
    <li key={key} className="flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1">
        <Link href={e.href} className="text-fg hover:text-accent font-medium">
          {e.name}
        </Link>
        {extra}
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("remove", { name: e.name })}
        onClick={() => personal.remove(collection, item)}
      >
        <X aria-hidden className="size-4" />
      </Button>
    </li>
  );

  const section = (
    id: Collection,
    icon: ReactNode,
    count: number,
    empty: string,
    items: ReactNode,
    action?: ReactNode,
  ) => (
    <section aria-labelledby={`lib-${id}`} className="border-border bg-surface rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 id={`lib-${id}`} className="mr-auto font-semibold">
          {t(id)} <span className="text-fg-muted text-sm font-normal">({count})</span>
        </h2>
        {count ? action : null}
      </div>
      {count ? (
        <ul className="divide-border mt-2 divide-y">{items}</ul>
      ) : (
        <p className="text-fg-muted mt-2 text-sm">{empty}</p>
      )}
    </section>
  );

  const iconClass = "text-accent size-5";
  const configured = getSupabaseConfig() !== null;

  return (
    <div className="space-y-4">
      <div
        role="status"
        className="border-border bg-surface-muted flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm"
      >
        {userId ? (
          status === "error" ? (
            <>
              <CloudOff aria-hidden className="text-lit-red size-5" />
              <span className="flex-1">{t("syncError")}</span>
            </>
          ) : (
            <>
              <Cloud aria-hidden className="text-accent size-5" />
              <span className="flex-1">{status === "syncing" ? t("syncing") : t("synced")}</span>
            </>
          )
        ) : (
          <>
            <CloudOff aria-hidden className="text-fg-muted size-5" />
            <span className="flex-1">
              <span className="text-fg block font-medium">{t("deviceOnly")}</span>
              {configured ? t("deviceOnlyBody") : null}
            </span>
            {configured ? (
              <Link
                href={`/login?next=${encodeURIComponent(`/${locale}/library`)}`}
                className={buttonClasses({ size: "sm" })}
              >
                <LogIn aria-hidden className="size-4" />
                {t("signIn")}
              </Link>
            ) : null}
          </>
        )}
        <span className="text-fg-muted basis-full">{t("privacy")}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {section(
          "bookmarks",
          <Bookmark aria-hidden className={iconClass} />,
          store.bookmarks.length,
          t("emptyBookmarks"),
          store.bookmarks.map((b) => row(`${b.type}:${b.key}`, "bookmarks", b, entry(b.type, b.key))),
        )}
        {section(
          "highlights",
          <Highlighter aria-hidden className={iconClass} />,
          store.highlights.length,
          t("emptyHighlights"),
          store.highlights.map((h) =>
            row(
              String(h.vkey),
              "highlights",
              h,
              entry("verse", h.location),
              <span className="text-fg-muted mt-1 flex items-center gap-2 text-sm">
                <span aria-hidden className="size-3 rounded-full" style={{ background: `var(--hl-${h.color})` }} />
                {t(`colors.${h.color}`)}
              </span>,
            ),
          ),
        )}
        {section(
          "notes",
          <NotebookPen aria-hidden className={iconClass} />,
          store.notes.length,
          t("emptyNotes"),
          store.notes.map((n) =>
            row(
              `${n.type}:${n.key}`,
              "notes",
              n,
              entry(n.type, n.key),
              <p className="text-fg-muted mt-1 line-clamp-4 text-sm whitespace-pre-line">{n.body}</p>,
            ),
          ),
        )}
        {section(
          "favorites",
          <Heart aria-hidden className={iconClass} />,
          store.favorites.length,
          t("emptyFavorites"),
          store.favorites.map((f) =>
            row(
              `${f.type}:${f.key}`,
              "favorites",
              f,
              entry(f.type, f.key),
              <span className="text-fg-muted block text-sm">{t(`kind.${f.type}`)}</span>,
            ),
          ),
        )}
      </div>

      {section(
        "history",
        <History aria-hidden className={iconClass} />,
        store.history.length,
        t("emptyHistory"),
        store.history.slice(0, 50).map((h) =>
          row(
            `${h.type}:${h.key}`,
            "history",
            h,
            entry(h.type, h.key, h.title),
            <span className="text-fg-muted block text-sm">
              {t(`kind.${h.type}`)} · {when(h.at)}
            </span>,
          ),
        ),
        <Button size="sm" variant="ghost" onClick={() => personal.clear("history")}>
          {t("clearHistory")}
        </Button>,
      )}

      <Button variant="secondary" onClick={download}>
        <Download aria-hidden className="size-4" />
        {t("download")}
      </Button>
    </div>
  );
}
