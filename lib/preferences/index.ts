/**
 * Reader preferences (theme, text size). Pure helpers shared by the pre-paint
 * script, the client provider and tests. Persisted per device in localStorage
 * until accounts exist (Phase 3 / 10), when they also sync to `profiles`.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export const FONT_SCALE = { min: 0.875, max: 1.5, step: 0.125, default: 1 } as const;

export const STORAGE_KEYS = {
  theme: "pref:theme",
  fontScale: "pref:fontScale",
} as const;

export function parseTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) return FONT_SCALE.default;
  const stepped = Math.round(value / FONT_SCALE.step) * FONT_SCALE.step;
  return Math.min(FONT_SCALE.max, Math.max(FONT_SCALE.min, stepped));
}

export function parseFontScale(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") return FONT_SCALE.default;
  if (typeof value === "string" && value.trim() === "") return FONT_SCALE.default;
  return clampFontScale(Number(value));
}

export function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme
 * or text size. It is a static string built from constants (no user input).
 */
export const preferencesInitScript = `(function(){try{
var d=document.documentElement,s=localStorage;
var t=s.getItem(${JSON.stringify(STORAGE_KEYS.theme)});
if(t!=="light"&&t!=="dark")t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
d.dataset.theme=t;
var f=parseFloat(s.getItem(${JSON.stringify(STORAGE_KEYS.fontScale)}));
if(f>=${FONT_SCALE.min}&&f<=${FONT_SCALE.max})d.style.setProperty("--font-scale",String(f));
}catch(e){}})();`;
