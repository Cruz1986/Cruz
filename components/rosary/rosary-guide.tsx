"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Pause, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import {
  clampIndex,
  decadeStarts,
  parseProgress,
  type MysterySetKey,
  type RosaryPosition,
} from "@/lib/rosary/sequence";
import type { Mystery, RosaryPrayer } from "@/lib/content/rosary";
import { Button, buttonClasses } from "@/components/ui/button";
import { PrayerText } from "@/components/prayers/prayer-text";
import { cn } from "@/lib/cn";

export const PROGRESS_KEY = "rosary:progress";

function save(set: string, index: number) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ set, index, savedAt: Date.now() }));
  } catch {
    // storage unavailable: progress is not kept
  }
}

function clear() {
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
}

export function RosaryGuide({
  setKey,
  setName,
  positions,
  mysteries,
  prayers,
  scriptureLinks,
}: {
  setKey: MysterySetKey;
  setName: string;
  positions: RosaryPosition[];
  mysteries: Mystery[];
  prayers: Record<string, RosaryPrayer>;
  /** Bible links for each mystery's Scripture reference (null when it can't be resolved). */
  scriptureLinks: (string | null)[];
}) {
  const t = useTranslations("rosary");
  const locale = useLocale();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Resume progress saved on this device for the same mysteries.
  useEffect(() => {
    let saved = null;
    try {
      saved = parseProgress(window.localStorage.getItem(PROGRESS_KEY));
    } catch {
      saved = null;
    }
    if (saved && saved.set === setKey && saved.index > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
      setIndex(clampIndex(saved.index, positions.length));
      setResumed(true);
    }
  }, [setKey, positions.length]);

  // After a move, focus the new step's heading (once it has rendered) so screen readers announce it.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [index]);

  const go = useCallback(
    (next: number) => {
      if (next >= positions.length) {
        clear();
        setFinished(true);
        return;
      }
      const clamped = clampIndex(next, positions.length);
      setIndex(clamped);
      setResumed(false);
      save(setKey, clamped);
      moved.current = true;
    },
    [positions.length, setKey],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (
        e.key === "ArrowRight" ||
        (e.key === " " && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement))
      ) {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, finished]);

  if (finished) {
    return (
      <section className="border-border bg-surface space-y-4 rounded-2xl border p-6 text-center">
        <h2 className="text-xl font-semibold">{t("finished")}</h2>
        <p className="text-fg-muted">{t("finishedBody")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              setFinished(false);
              go(0);
            }}
          >
            <RotateCcw aria-hidden className="size-4" />
            {t("prayAgain")}
          </Button>
          <Link href="/rosary" className={buttonClasses({ variant: "secondary" })}>
            {t("backToRosary")}
          </Link>
        </div>
      </section>
    );
  }

  const position = positions[index];
  const mystery = position.decade ? mysteries[position.decade - 1] : null;
  const prayer = position.prayerSlug ? prayers[position.prayerSlug] : null;
  const pick = (ta: string | null, en: string | null) => (locale === "ta" ? (ta ?? en) : (en ?? ta));
  const prayerBody = prayer ? pick(prayer.bodyTa, prayer.bodyEn) : null;
  const prayerLang = prayer ? (locale === "ta" ? (prayer.bodyTa ? "ta" : "en") : prayer.bodyEn ? "en" : "ta") : locale;
  const prayerTitle = prayer ? (pick(prayer.titleTa, prayer.titleEn) ?? "") : "";
  const label = pick(position.labelTa, position.labelEn);
  const fruit = mystery ? pick(mystery.fruitTa, mystery.fruitEn) : null;
  const starts = decadeStarts(positions);

  const stage = position.decade
    ? t("decadeOf", { decade: position.decade })
    : t(`phase.${position.phase as "opening" | "closing"}`);
  const counter =
    position.of > 1 ? t("countOf", { title: prayerTitle, count: position.count, of: position.of }) : prayerTitle;

  return (
    <div className="space-y-5">
      {resumed ? (
        <p
          role="status"
          className="bg-accent-soft flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-sm"
        >
          {t("resumed")}
          <Button size="sm" variant="ghost" onClick={() => go(0)}>
            <RotateCcw aria-hidden className="size-4" />
            {t("startOver")}
          </Button>
        </p>
      ) : null}

      {/* Progress: opening · five decades · closing */}
      <nav aria-label={setName} className="space-y-2">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "h-2 flex-1 rounded-full",
              index >= starts[0] ? "bg-accent" : position.phase === "opening" ? "bg-accent/50" : "bg-surface-muted",
            )}
          />
          {starts.map((start, d) => {
            const active = position.decade === d + 1;
            const done = (position.decade ?? (position.phase === "closing" ? 6 : 0)) > d + 1;
            return (
              <button
                key={d}
                type="button"
                onClick={() => go(start)}
                aria-label={t("jumpToDecade", { decade: d + 1 })}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "h-2 flex-[2] rounded-full",
                  done ? "bg-accent" : active ? "bg-accent/50" : "bg-surface-muted",
                )}
              />
            );
          })}
          <span
            className={cn(
              "h-2 flex-1 rounded-full",
              position.phase === "closing" ? "bg-accent/50" : "bg-surface-muted",
            )}
          />
        </div>
        <p className="text-fg-muted text-sm">
          {stage} · {t("progress", { done: index + 1, total: positions.length })}
        </p>
      </nav>

      {mystery ? (
        <section className="border-gold/40 bg-surface rounded-2xl border p-5">
          <p className="text-gold text-sm font-semibold">{t(`ordinal.${position.decade as 1}`)}</p>
          <h2
            ref={prayer ? undefined : heading}
            tabIndex={prayer ? undefined : -1}
            className="mt-1 text-xl font-bold outline-none"
            lang={locale === "ta" ? "ta" : "en"}
          >
            {locale === "ta" ? mystery.titleTa : mystery.titleEn}
          </h2>
          {position.prayerSlug === null ? (
            <div className="mt-3 space-y-2">
              {mystery.scripture ? (
                <p className="text-sm">
                  {scriptureLinks[mystery.number - 1] ? (
                    <Link
                      href={scriptureLinks[mystery.number - 1]!}
                      className="text-accent inline-flex items-center gap-1 hover:underline"
                    >
                      <BookOpen aria-hidden className="size-4" />
                      {t("scripture", { reference: mystery.scripture })}
                    </Link>
                  ) : (
                    t("scripture", { reference: mystery.scripture })
                  )}
                </p>
              ) : null}
              {fruit ? <p className="text-fg-muted text-sm">{t("fruit", { fruit })}</p> : null}
              {pick(mystery.meditationTa, mystery.meditationEn) ? (
                <p className="reading max-w-none" lang={locale === "ta" && mystery.meditationTa ? "ta" : "en"}>
                  {pick(mystery.meditationTa, mystery.meditationEn)}
                </p>
              ) : null}
              <p className="text-fg-muted text-sm italic">{t("announce")}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {prayer ? (
        <section aria-live="polite" className="border-border bg-surface rounded-2xl border p-5">
          <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
            {counter}
          </h2>
          {label ? <p className="text-fg-muted mt-1 text-sm">{label}</p> : null}
          {position.of === 10 ? (
            <ol aria-hidden className="mt-3 flex gap-1.5">
              {Array.from({ length: 10 }, (_, i) => (
                <li
                  key={i}
                  className={cn("border-accent size-3 rounded-full border", i < position.count && "bg-accent")}
                />
              ))}
            </ol>
          ) : null}
          {prayerBody ? (
            <PrayerText text={prayerBody} language={prayerLang} className="mt-4" />
          ) : (
            <p className="text-fg-muted mt-3 text-sm">{t("prayerMissing")}</p>
          )}
        </section>
      ) : mystery ? null : (
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          {stage}
        </h2>
      )}

      <div className="border-border bg-surface/95 sticky bottom-20 z-20 flex items-center gap-2 rounded-2xl border p-2 backdrop-blur lg:bottom-4">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t("previous")}>
          <ChevronLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">{t("previous")}</span>
        </Button>
        <Button className="flex-1" onClick={() => go(index + 1)}>
          {t("next")}
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          aria-label={t("pause")}
          onClick={() => {
            save(setKey, index);
            router.push("/rosary");
          }}
        >
          <Pause aria-hidden className="size-4" />
          <span className="hidden sm:inline">{t("pause")}</span>
        </Button>
      </div>
      <p className="text-fg-muted hidden text-xs lg:block">{t("keyboardHint")}</p>
    </div>
  );
}
