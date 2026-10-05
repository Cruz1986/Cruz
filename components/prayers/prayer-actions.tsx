"use client";

import { useState } from "react";
import { Check, Copy, Heart, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFavoritePrayers } from "./favorites";

export function PrayerActions({ slug, title, plainText }: { slug: string; title: string; plainText: string }) {
  const t = useTranslations("prayers");
  const { slugs, toggle } = useFavoritePrayers();
  const [copied, setCopied] = useState(false);
  const saved = slugs.includes(slug);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${plainText}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, text: `${title}\n\n${plainText}`, url: window.location.href });
    } catch {
      // cancelled
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={saved ? "primary" : "secondary"} aria-pressed={saved} onClick={() => toggle(slug)}>
        <Heart aria-hidden className={saved ? "size-4 fill-current" : "size-4"} />
        {saved ? t("saved") : t("save")}
      </Button>
      <Button size="sm" variant="secondary" onClick={copy}>
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
      </Button>
      <Button size="sm" variant="secondary" onClick={share}>
        <Share2 aria-hidden className="size-4" />
        {t("share")}
      </Button>
    </div>
  );
}
