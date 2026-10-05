"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

const KEY = "bible:last";
type Position = { translation: string; book: string; chapter: number; title: string };

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Position | null {
  try {
    const value = raw ? (JSON.parse(raw) as Position) : null;
    return value && typeof value.chapter === "number" && typeof value.book === "string" ? value : null;
  } catch {
    return null;
  }
}

/** Remembers the chapter being read on this device (accounts sync it later, Phase 10). */
export function RememberPosition(position: Position) {
  const { translation, book, chapter, title } = position;
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ translation, book, chapter, title }));
    } catch {
      // storage unavailable
    }
  }, [translation, book, chapter, title]);
  return null;
}

const subscribe = () => () => {};

export function ContinueReading() {
  const t = useTranslations("bible");
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const position = parse(raw);
  if (!position) return null;

  return (
    <Link
      href={`/bible/${position.translation}/${position.book.toLowerCase()}/${position.chapter}`}
      className="border-accent/30 bg-accent-soft text-fg hover:border-accent flex items-center gap-3 rounded-2xl border p-4"
    >
      <BookOpen aria-hidden className="text-accent size-5" />
      <span className="flex-1">
        <span className="text-fg-muted block text-sm">{t("continueReading")}</span>
        <span className="font-semibold">{position.title}</span>
      </span>
      <ArrowRight aria-hidden className="text-accent size-4" />
    </Link>
  );
}
