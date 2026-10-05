"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { FONT_SCALE, THEMES, type Theme } from "@/lib/preferences";
import { cn } from "@/lib/cn";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { usePreferences } from "./preferences-provider";

const THEME_LABEL_KEYS = { system: "themeSystem", light: "themeLight", dark: "themeDark" } as const;

export function SettingsPanel() {
  const t = useTranslations("settings");
  const tLanguage = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const { theme, setTheme, fontScale, setFontScale } = usePreferences();

  const themeOptions = THEMES.map((value: Theme) => ({ value, label: t(THEME_LABEL_KEYS[value]) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{t("language")}</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {routing.locales.map((l) => (
            <Link
              key={l}
              href={pathname}
              locale={l}
              lang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-5 font-medium",
                l === locale
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg hover:bg-surface-muted",
              )}
            >
              {tLanguage(l)}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t("theme")}</CardTitle>
        <div className="mt-3">
          <SegmentedControl label={t("theme")} options={themeOptions} value={theme} onChange={setTheme} />
        </div>
      </Card>

      <Card>
        <CardTitle id="font-size-label">{t("fontSize")}</CardTitle>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            aria-label={t("decrease")}
            disabled={fontScale <= FONT_SCALE.min}
            onClick={() => setFontScale(fontScale - FONT_SCALE.step)}
            size="icon"
          >
            <Minus aria-hidden className="size-4" />
          </Button>
          <input
            type="range"
            aria-labelledby="font-size-label"
            aria-valuetext={t("fontSizeValue", { percent: Math.round(fontScale * 100) })}
            min={FONT_SCALE.min}
            max={FONT_SCALE.max}
            step={FONT_SCALE.step}
            value={fontScale}
            onChange={(event) => setFontScale(Number(event.target.value))}
            className="accent-accent h-2 flex-1 cursor-pointer"
          />
          <Button
            variant="secondary"
            aria-label={t("increase")}
            disabled={fontScale >= FONT_SCALE.max}
            onClick={() => setFontScale(fontScale + FONT_SCALE.step)}
            size="icon"
          >
            <Plus aria-hidden className="size-4" />
          </Button>
          <output className="text-fg-muted w-14 text-right tabular-nums">
            {t("fontSizeValue", { percent: Math.round(fontScale * 100) })}
          </output>
        </div>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setFontScale(FONT_SCALE.default)}>
          {t("reset")}
        </Button>
        <div className="bg-surface-muted mt-4 rounded-xl p-4">
          <p className="text-fg-muted mb-1 text-sm font-medium">{t("preview")}</p>
          <p className="reading">{t("previewText")}</p>
        </div>
      </Card>
    </div>
  );
}
