"use client";

import { AArrowDown, AArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { FONT_SCALE } from "@/lib/preferences";
import { usePreferences } from "@/components/preferences/preferences-provider";
import { Button } from "@/components/ui/button";

/** Quick text-size control in the reader (same setting as Settings → Text size). */
export function ReadingSize() {
  const t = useTranslations("settings");
  const tb = useTranslations("bible");
  const { fontScale, setFontScale } = usePreferences();
  return (
    <div role="group" aria-label={tb("readingSize")} className="inline-flex gap-1">
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("decrease")}
        disabled={fontScale <= FONT_SCALE.min}
        onClick={() => setFontScale(fontScale - FONT_SCALE.step)}
      >
        <AArrowDown aria-hidden className="size-5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("increase")}
        disabled={fontScale >= FONT_SCALE.max}
        onClick={() => setFontScale(fontScale + FONT_SCALE.step)}
      >
        <AArrowUp aria-hidden className="size-5" />
      </Button>
    </div>
  );
}
