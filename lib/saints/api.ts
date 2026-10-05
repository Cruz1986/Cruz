import type { SaintSummary } from "./helpers";

/** The JSON shape of a saint in list responses. */
export function saintSummaryJson(s: SaintSummary) {
  return {
    slug: s.slug,
    name: { en: s.nameEn, ta: s.nameTa },
    title: { en: s.titleEn, ta: s.titleTa },
    feast:
      s.feastMonth && s.feastDay
        ? `${String(s.feastMonth).padStart(2, "0")}-${String(s.feastDay).padStart(2, "0")}`
        : null,
    patronage: { en: s.patronageEn, ta: s.patronageTa },
  };
}
