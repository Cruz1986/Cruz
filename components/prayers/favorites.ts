"use client";

import { useCallback } from "react";
import { personal, usePersonalStore } from "@/lib/personal/client";

/** Favourite prayers from the reader's library (on this device, and in their account when signed in). */
export function useFavoritePrayers() {
  const store = usePersonalStore();
  const slugs = store.favorites.filter((f) => f.type === "prayer").map((f) => f.key);
  const toggle = useCallback((slug: string) => personal.toggleFavorite("prayer", slug), []);
  return { slugs, toggle };
}
