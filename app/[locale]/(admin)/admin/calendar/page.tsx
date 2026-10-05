import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ChevronLeft, ChevronRight, ExternalLink, Pencil } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { STAFF_ROLES, isPublisher } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { CALENDARS, type CalendarCode } from "@/lib/liturgy";
import { addDays, parseIsoDate, todayIn, toIso } from "@/lib/liturgy/plain-date";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { DayForm } from "@/components/admin/calendar-forms";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string; cal?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminCalendar");
  return { title: t("title"), robots: { index: false } };
}

const reading = z.object({
  id: z.string(),
  reading_type: z.string(),
  sequence: z.number(),
  alt_group: z.number(),
  is_short: z.boolean(),
  reference_display: z.string(),
  is_edited: z.boolean(),
});
const daySchema = z.object({
  id: z.string(),
  date: z.string(),
  title_en: z.string(),
  title_ta: z.string(),
  color: z.string(),
  notes_en: z.string().nullable(),
  notes_ta: z.string().nullable(),
  is_override: z.boolean(),
  liturgical_day_celebrations: z.array(
    z.object({
      sort_order: z.number(),
      celebrations: z.object({ id: z.string(), name_en: z.string(), name_ta: z.string(), rank: z.string() }),
    }),
  ),
  liturgical_day_masses: z.array(
    z.object({
      mass_key: z.string(),
      role: z.string(),
      sort_order: z.number(),
      lectionary_sets: z.object({ code: z.string(), lectionary_readings: z.array(reading) }),
    }),
  ),
});

const TYPE_ORDER = ["procession_gospel", "first", "psalm", "second", "sequence", "acclamation", "gospel"];

export default async function AdminCalendarPage({ params, searchParams }: Props) {
  const locale = await initPage(params);
  const user = await requireRoles(STAFF_ROLES, { locale, nextPath: `/${locale}/admin/calendar` });
  const query = await searchParams;
  const date = (query.date && parseIsoDate(query.date)) || todayIn(DEFAULT_TIME_ZONE);
  const iso = toIso(date);
  const cal: CalendarCode = query.cal && query.cal in CALENDARS ? (query.cal as CalendarCode) : "in";
  const t = await getTranslations();
  const db = await adminDb();

  const { data, error } = await db
    .from("liturgical_days")
    .select(
      `id, date, title_en, title_ta, color, notes_en, notes_ta, is_override,
       liturgical_calendars!inner(code),
       liturgical_day_celebrations(sort_order, celebrations(id, name_en, name_ta, rank)),
       liturgical_day_masses(mass_key, role, sort_order, lectionary_sets(code,
         lectionary_readings(id, reading_type, sequence, alt_group, is_short, reference_display, is_edited)))`,
    )
    .eq("liturgical_calendars.code", cal)
    .eq("date", iso)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const day = data ? daySchema.parse(data) : null;
  const href = (d: string) => `/admin/calendar?date=${d}${cal !== "in" ? `&cal=${cal}` : ""}`;
  const publisher = isPublisher(user.roles);

  return (
    <>
      <PageHeader title={t("adminCalendar.title")} description={t("adminCalendar.description")}>
        <Link href="/admin/calendar/celebrations" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          {t("adminCalendar.allCelebrations")}
        </Link>
      </PageHeader>

      <form className="border-border bg-surface mb-4 flex flex-wrap items-end gap-3 rounded-2xl border p-4">
        <label className="text-sm font-medium">
          {t("adminCalendar.date")}
          <input
            type="date"
            name="date"
            defaultValue={iso}
            className="border-border bg-surface mt-1 block rounded-xl border px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium">
          {t("adminCalendar.calendar")}
          <select
            name="cal"
            defaultValue={cal}
            className="border-border bg-surface mt-1 block rounded-xl border px-3 py-2"
          >
            {Object.keys(CALENDARS).map((c) => (
              <option key={c} value={c}>
                {c === "in" ? "India" : "General Roman"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClasses({ size: "sm", variant: "secondary" })}>
          {t("adminCalendar.show")}
        </button>
        <span className="ml-auto flex gap-2">
          <Link href={href(toIso(addDays(date, -1)))} className={buttonClasses({ size: "sm", variant: "ghost" })}>
            <ChevronLeft aria-hidden className="size-4" />
            {t("adminCalendar.previousDay")}
          </Link>
          <Link href={href(toIso(addDays(date, 1)))} className={buttonClasses({ size: "sm", variant: "ghost" })}>
            {t("adminCalendar.nextDay")}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </span>
      </form>

      {!day ? (
        <EmptyState title={t("adminCalendar.noDay")} />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="day" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="day" className="mr-auto text-lg font-semibold">
                {t("adminCalendar.day")}: {locale === "ta" ? day.title_ta : day.title_en}
              </h2>
              <Link href={`/today/${iso}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                <ExternalLink aria-hidden className="size-4" />
                {t("adminCalendar.openPublic")}
              </Link>
            </div>
            {publisher ? (
              <DayForm
                key={day.id}
                id={day.id}
                date={iso}
                initial={{
                  titleEn: day.title_en,
                  titleTa: day.title_ta,
                  color: day.color,
                  notesEn: day.notes_en ?? "",
                  notesTa: day.notes_ta ?? "",
                  isOverride: day.is_override ? "on" : "",
                }}
              />
            ) : (
              <p className="bg-surface-muted rounded-xl p-3 text-sm">{t("adminCalendar.publishersOnly")}</p>
            )}
          </section>

          <section aria-labelledby="celebrations" className="border-border bg-surface rounded-2xl border p-4">
            <h2 id="celebrations" className="mb-2 font-semibold">
              {t("adminCalendar.celebrations")}
            </h2>
            <ul className="space-y-1">
              {day.liturgical_day_celebrations
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(({ celebrations: c }) => (
                  <li key={c.id}>
                    <Link href={`/admin/calendar/celebrations/${c.id}`} className="text-accent hover:underline">
                      {locale === "ta" ? c.name_ta : c.name_en}
                    </Link>
                    <span className="text-fg-muted text-sm">
                      {" "}
                      · {t(`today.kind.${c.rank}` as "today.kind.memorial")}
                    </span>
                  </li>
                ))}
            </ul>
          </section>

          <section aria-labelledby="readings" className="space-y-3">
            <h2 id="readings" className="text-lg font-semibold">
              {t("adminCalendar.readings")}
            </h2>
            {day.liturgical_day_masses
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((m) => (
                <div
                  key={`${m.mass_key}-${m.lectionary_sets.code}`}
                  className="border-border bg-surface rounded-2xl border p-4"
                >
                  <p className="text-fg-muted mb-2 text-sm">
                    {t(`today.mass.${m.mass_key}` as "today.mass.day")} ·{" "}
                    {t("adminCalendar.set", { code: m.lectionary_sets.code })}
                  </p>
                  <ul className="divide-border divide-y">
                    {m.lectionary_sets.lectionary_readings
                      .sort(
                        (a, b) =>
                          a.sequence - b.sequence ||
                          TYPE_ORDER.indexOf(a.reading_type) - TYPE_ORDER.indexOf(b.reading_type) ||
                          a.alt_group - b.alt_group ||
                          Number(a.is_short) - Number(b.is_short),
                      )
                      .map((r) => (
                        <li key={r.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <span className="text-fg-muted w-36 shrink-0">
                            {t(`today.reading.${r.reading_type}` as "today.reading.first")}
                            {r.alt_group ? ` (${r.alt_group})` : ""}
                          </span>
                          <span className="flex-1" lang="ta">
                            {r.reference_display}
                            {r.is_edited ? (
                              <span className="text-gold ml-2 text-xs">{t("adminCalendar.edited")}</span>
                            ) : null}
                          </span>
                          {publisher && r.reading_type !== "commons" ? (
                            <Link
                              href={`/admin/calendar/readings/${r.id}`}
                              aria-label={`${t("adminCalendar.editReading")}: ${r.reference_display}`}
                              className={buttonClasses({ variant: "ghost", size: "icon" })}
                            >
                              <Pencil aria-hidden className="size-4" />
                            </Link>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </section>
        </div>
      )}
    </>
  );
}
