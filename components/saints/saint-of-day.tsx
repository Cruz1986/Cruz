import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { Saint } from "@/lib/content/saints";
import { excerpt, saintName, saintTitle } from "@/lib/saints/helpers";

/** Today's saints with the start of their life story. */
export async function SaintOfDay({ saints }: { saints: Saint[] }) {
  const t = await getTranslations("saints");
  const locale = await getLocale();

  return (
    <section aria-labelledby="saint-of-day" className="space-y-3">
      <h2 id="saint-of-day" className="flex items-center gap-2 text-lg font-semibold">
        <Sparkles aria-hidden className="text-gold size-5" />
        {saints.length > 1 ? t("ofTheDayMany") : t("ofTheDay")}
      </h2>
      {saints.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {saints.map((s) => {
            const bio = locale === "ta" ? (s.biographyTa ?? s.biographyEn) : (s.biographyEn ?? s.biographyTa);
            const bioLang = locale === "ta" && s.biographyTa ? "ta" : "en";
            const title = saintTitle(s, locale);
            return (
              <li key={s.slug} className="border-gold/40 bg-surface flex gap-4 rounded-2xl border p-5">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- images come from Supabase storage with known sizes
                  <img
                    src={s.image.url}
                    alt={(locale === "ta" ? (s.image.altTa ?? s.image.altEn) : (s.image.altEn ?? s.image.altTa)) ?? ""}
                    className="size-20 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0 space-y-2">
                  <h3 className="text-fg text-lg font-bold">
                    <Link href={`/saints/${s.slug}`} className="hover:text-accent">
                      {saintName(s, locale)}
                    </Link>
                  </h3>
                  {title ? <p className="text-fg-muted text-sm">{title}</p> : null}
                  {bio ? (
                    <p lang={bioLang} className="text-fg">
                      {excerpt(bio)}
                    </p>
                  ) : null}
                  <Link
                    href={`/saints/${s.slug}`}
                    className="text-accent inline-flex min-h-10 items-center gap-1 text-sm font-medium hover:underline"
                    aria-label={`${t("readMore")}: ${saintName(s, locale)}`}
                  >
                    {t("readMore")}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bg-surface-muted text-fg-muted rounded-xl p-4">{t("noneToday")}</p>
      )}
    </section>
  );
}
