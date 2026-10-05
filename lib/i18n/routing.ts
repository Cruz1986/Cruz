import { defineRouting } from "next-intl/routing";

export const locales = ["ta", "en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "ta",
  localePrefix: "always",
});
