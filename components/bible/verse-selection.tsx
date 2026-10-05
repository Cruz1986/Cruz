"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Selected = { verse: number; label: string; text: string };

/**
 * Tap verses to select them, then copy or share. Uses event delegation over the
 * server-rendered chapter text (verses carry data-verse / data-label / data-text).
 */
export function VerseSelection({ reference, children }: { reference: string; children: ReactNode }) {
  const t = useTranslations("bible");
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [copied, setCopied] = useState<"text" | "link" | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-verse]")) {
      const on = selected.some((s) => String(s.verse) === el.dataset.verse);
      el.classList.toggle("bg-accent-soft", on);
      el.setAttribute("aria-selected", String(on));
    }
  }, [selected]);

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
        : [...current, { verse, label: el.dataset.label ?? String(verse), text: el.dataset.text ?? "" }].sort(
            (a, b) => a.verse - b.verse,
          ),
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
          <div className="border-border bg-surface mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border p-3 shadow-lg">
            <p className="text-fg mr-auto text-sm font-medium" aria-live="polite">
              {copied ? t("copied") : t("selected", { count: selected.length })}
            </p>
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
            <Button size="icon" variant="ghost" aria-label={t("clearSelection")} onClick={() => setSelected([])}>
              <X aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
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
