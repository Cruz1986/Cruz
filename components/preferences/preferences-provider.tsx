"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  FONT_SCALE,
  STORAGE_KEYS,
  clampFontScale,
  parseFontScale,
  parseTheme,
  resolveTheme,
  type Theme,
} from "@/lib/preferences";

type PreferencesContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  fontScale: number;
  setFontScale: (scale: number) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/* localStorage-backed store: same-tab writes notify via a custom event, other tabs via "storage". */
const CHANGE_EVENT = "preferences-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the preference still applies for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(theme, prefersDark);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    () => parseTheme(readStorage(STORAGE_KEYS.theme)),
    () => "system" as const,
  );
  const fontScale = useSyncExternalStore(
    subscribe,
    () => parseFontScale(readStorage(STORAGE_KEYS.fontScale)),
    () => FONT_SCALE.default,
  );

  // Keep <html> in sync (covers changes made in other tabs and OS theme changes).
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  const setTheme = useCallback((next: Theme) => writeStorage(STORAGE_KEYS.theme, next), []);
  const setFontScale = useCallback(
    (next: number) => writeStorage(STORAGE_KEYS.fontScale, String(clampFontScale(next))),
    [],
  );

  const value = useMemo(
    () => ({ theme, setTheme, fontScale, setFontScale }),
    [theme, setTheme, fontScale, setFontScale],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return context;
}
