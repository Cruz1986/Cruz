"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bookmark, Check, Copy, Highlighter, Link2, NotebookPen, Share2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { personal, usePersonalStore } from "@/lib/personal/client";
import { HIGHLIGHT_COLORS, verseKey } from "@/lib/personal/store";
import { NoteDialog } from "@/components/personal/note-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Selected = { verse: number; label: string; text: string; vkey: number | null };
export type ChapterLocation = { translation: string; book: string; chapter: number };

/**
 * Tap verses to select them, then copy, share, bookmark, highlight or add a note. Uses event
 * delegation over the server-rendered chapter text (verses carry data-verse / data-label /
 * data-text / data-key) and marks the reader's highlights, bookmarks and notes on it.
 */
export function VerseSelection({
  reference,
  location,
  children,
}: {
  reference: string;
  location: ChapterLocation;
  children: ReactNode;
}) {
  const t = useTranslations("bible");
  const tp = useTranslations("personal");
  const container = useRef<HTMLDivElement>(null);
  const store = usePersonalStore();
  const [selected, setSelected] = useState<Selected[]>([]);
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [palette, setPalette] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const { translation, book, chapter } = location;
  const keyOf = (verse: number) => verseKey(translation, book, chapter, verse);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const highlights = new Map(store.highlights.map((h) => [String(h.vkey), h.color]));
    const bookmarks = new Set(store.bookmarks.filter((b) => b.type === "verse").map((b) => b.key));
    const notes = new Set(store.notes.filter((n) => n.type === "verse").map((n) => n.key));
    for (const el of root.querySelectorAll<HTMLElement>("[data-verse]")) {
      const verse = Number(el.dataset.verse);
      const on = selected.some((s) => s.verse === verse);
      el.toggleAttribute("data-selected", on);
      const color = el.dataset.key ? highlights.get(el.dataset.key) : undefined;
      if (color) el.dataset.highlight = color;
      else delete el.dataset.highlight;
      const key = verseKey(translation, book, chapter, verse);
      el.toggleAttribute("data-bookmarked", bookmarks.has(key));
      el.toggleAttribute("data-noted", notes.has(key));
    }
  }, [selected, store, translation, book, chapter]);

  function toggle(target: EventTarget | null) {
    if (!(target instanceof Element)) return;
    if (window.getSelection()?.toString()) return; // the reader is selecting text manually
    const el = target.closest<HTMLElement>("[data-verse]");
    if (!el) return;
    const verse = Number(el.dataset.verse);
    setCopied(null);
    setSelected((current) =>
      current.some((s) => s.verse === verse)
        ? current.filter((s) => s.verse !== verse)
        : [
            ...current,
            {
              verse,
              label: el.dataset.label ?? String(verse),
              text: el.dataset.text ?? "",
              vkey: el.dataset.key ? Number(el.dataset.key) : null,
            },
          ].sort((a, b) => a.verse - b.verse),
    );
  }

  const label = selected.length ? `${reference}:${rangeLabel(selected)}` : reference;
  const text = `${selected.map((s) => `${s.label} ${s.text.replace(/\n/g, " ")}`).join(" ")}\n— ${label}`;
  const url = () => `${window.location.origin}${window.location.pathname}#v${selected[0]?.verse ?? ""}`;

  async function copy(kind: "text" | "link") {
    try {
      await navigator.clipboard.writeText(kind === "text" ? text : url());
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  async function share() {
    if (!navigator.share) return copy("text");
    try {
      await navigator.share({ title: label, text, url: url() });
    } catch {
      // cancelled
    }
  }

  const isBookmarked = (s: Selected) => store.bookmarks.some((b) => b.type === "verse" && b.key === keyOf(s.verse));
  const allBookmarked = selected.length > 0 && selected.every(isBookmarked);
  function bookmark() {
    for (const s of selected)
      if (allBookmarked || !isBookmarked(s)) personal.toggleBookmark("verse", keyOf(s.verse), s.vkey);
  }

  const highlightable = selected.filter((s) => s.vkey !== null);
  const colorOf = (s: Selected) => store.highlights.find((h) => h.vkey === s.vkey)?.color ?? null;
  function highlight(color: (typeof HIGHLIGHT_COLORS)[number] | null) {
    for (const s of highlightable) personal.setHighlight(s.vkey!, keyOf(s.verse), color);
    setPalette(false);
  }

  const noteVerse = selected[0];
  const note = noteVerse ? store.notes.find((n) => n.type === "verse" && n.key === keyOf(noteVerse.verse)) : undefined;

  return (
    <>
      <div
        ref={container}
        // Pointer convenience only: keyboard and screen-reader users copy text the usual way.
        onClick={(e) => toggle(e.target)}
        className="[&_[data-verse]]:cursor-pointer"
      >
        {children}
      </div>

      {selected.length ? (
        <div
          role="toolbar"
          aria-label={t("selected", { count: selected.length })}
          className="fixed inset-x-0 bottom-16 z-40 px-4 pb-[env(safe-area-inset-bottom)] lg:bottom-6"
        >
          <div className="border-border bg-surface mx-auto max-w-xl space-y-2 rounded-2xl border p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <p className="text-fg mr-auto text-sm font-medium" aria-live="polite">
                {copied ? t("copied") : t("selected", { count: selected.length })}
              </p>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("clearSelection")}
                onClick={() => {
                  setSelected([]);
                  setPalette(false);
                }}
              >
                <X aria-hidden className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={allBookmarked ? "primary" : "secondary"}
                aria-pressed={allBookmarked}
                onClick={bookmark}
              >
                <Bookmark aria-hidden className={cn("size-4", allBookmarked && "fill-current")} />
                {allBookmarked ? tp("removeBookmark") : tp("bookmark")}
              </Button>
              {highlightable.length ? (
                <Button size="sm" variant="secondary" aria-expanded={palette} onClick={() => setPalette((p) => !p)}>
                  <Highlighter aria-hidden className="size-4" />
                  {tp("highlight")}
                </Button>
              ) : null}
              {selected.length === 1 ? (
                <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
                  <NotebookPen aria-hidden className="size-4" />
                  {note ? tp("editNote") : tp("note")}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => copy("text")}>
                {copied === "text" ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                {t("copy")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => copy("link")}>
                <Link2 aria-hidden className="size-4" />
                {t("copyLink")}
              </Button>
              <Button size="sm" onClick={share}>
                <Share2 aria-hidden className="size-4" />
                {t("share")}
              </Button>
            </div>
            {palette ? (
              <div role="group" aria-label={tp("highlight")} className="flex flex-wrap items-center gap-2">
                {HIGHLIGHT_COLORS.map((color) => {
                  const on = highlightable.every((s) => colorOf(s) === color);
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={tp(`colors.${color}`)}
                      aria-pressed={on}
                      onClick={() => highlight(color)}
                      style={{ background: `var(--hl-${color})` }}
                      className={cn(
                        "border-border size-10 rounded-full border-2",
                        on && "border-accent ring-accent ring-2 ring-offset-2",
                      )}
                    />
                  );
                })}
                {highlightable.some((s) => colorOf(s)) ? (
                  <Button size="sm" variant="ghost" onClick={() => highlight(null)}>
                    {tp("removeHighlight")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {noteVerse ? (
        <NoteDialog
          open={noteOpen}
          name={`${reference}:${noteVerse.label}`}
          initial={note?.body ?? ""}
          onSave={(body) => personal.saveNote("verse", keyOf(noteVerse.verse), noteVerse.vkey, body)}
          onClose={() => setNoteOpen(false)}
        />
      ) : null}
    </>
  );
}

/** "3-5, 8" from selected verses. */
export function rangeLabel(verses: { verse: number; label: string }[]): string {
  const parts: string[] = [];
  let start = verses[0];
  let prev = verses[0];
  for (const v of [...verses.slice(1), null]) {
    if (v && v.verse === prev.verse + 1) {
      prev = v;
      continue;
    }
    parts.push(start === prev ? start.label : `${start.label}-${prev.label}`);
    if (v) start = prev = v;
  }
  return parts.join(", ");
}
