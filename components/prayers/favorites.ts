"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "prayers:favorites";
const EVENT = "prayers-favorites-change";

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Prayer slugs saved on this device (synced to the account in Phase 10). */
export function useFavoritePrayers() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  let slugs: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    slugs = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    slugs = [];
  }

  const toggle = useCallback((slug: string) => {
    let current: string[] = [];
    try {
      current = JSON.parse(read()) as string[];
    } catch {
      current = [];
    }
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { slugs, toggle };
}
