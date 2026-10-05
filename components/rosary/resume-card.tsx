"use client";

import { useSyncExternalStore } from "react";
import { ArrowRight, Flower2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { parseProgress } from "@/lib/rosary/sequence";
import { PROGRESS_KEY } from "./rosary-guide";

const subscribe = () => () => {};
function read() {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
}

/** Shown when a Rosary was paused on this device in the last day. */
export function ResumeCard({ names, total }: { names: Record<string, string>; total: number }) {
  const t = useTranslations("rosary");
  const progress = parseProgress(useSyncExternalStore(subscribe, read, () => null));
  if (!progress || !names[progress.set]) return null;
  return (
    <Link
      href={`/rosary/${progress.set}`}
      className="border-accent/30 bg-accent-soft text-fg hover:border-accent flex items-center gap-3 rounded-2xl border p-4"
    >
      <Flower2 aria-hidden className="text-accent size-5" />
      <span className="flex-1">
        <span className="block font-semibold">{t("resume")}</span>
        <span className="text-fg-muted block text-sm">
          {t("resumeDetail", {
            name: names[progress.set],
            progress: t("progress", { done: progress.index + 1, total }),
          })}
        </span>
      </span>
      <ArrowRight aria-hidden className="text-accent size-4" />
    </Link>
  );
}
