/**
 * Same normalisation as public.normalize_search_text() in the database: NFC, no zero-width
 * characters or soft hyphens, lower case, single spaces.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[​-‍­⁠﻿]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
