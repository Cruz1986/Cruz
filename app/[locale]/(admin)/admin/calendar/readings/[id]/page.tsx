import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { allBooks } from "@/lib/content/public-bible";
import { formatRanges } from "@/lib/liturgy/readings";
import { PageHeader } from "@/components/ui/page-header";
import { ReadingForm } from "@/components/admin/calendar-forms";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminCalendar");
  return { title: t("editReading"), robots: { index: false } };
}

export default async function EditReadingPage({ params }: Props) {
  const locale = await initPage(params);
  const { id } = await params;
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/calendar/readings/${id}` });
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await adminDb();
  const { data } = await db
    .from("lectionary_readings")
    .select(
      `id, reading_type, reference_display, lectionary_sets(code),
       lectionary_reading_ranges(seq, start_chapter, start_verse, start_part, end_chapter, end_verse, end_part, bible_books(code))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const r = z
    .object({
      id: z.string(),
      reading_type: z.string(),
      reference_display: z.string(),
      lectionary_sets: z.object({ code: z.string() }),
      lectionary_reading_ranges: z.array(
        z.object({
          seq: z.number(),
          start_chapter: z.number(),
          start_verse: z.number(),
          start_part: z.string(),
          end_chapter: z.number(),
          end_verse: z.number(),
          end_part: z.string(),
          bible_books: z.object({ code: z.string() }),
        }),
      ),
    })
    .parse(data);
  const t = await getTranslations();
  const books = await allBooks();
  const ranges = r.lectionary_reading_ranges
    .sort((a, b) => a.seq - b.seq)
    .map((g) => ({
      book: g.bible_books.code,
      startChapter: g.start_chapter,
      startVerse: g.start_verse,
      startPart: g.start_part,
      endChapter: g.end_chapter,
      endVerse: g.end_verse,
      endPart: g.end_part,
    }));

  return (
    <>
      <PageHeader
        title={t(`today.reading.${r.reading_type}` as "today.reading.first")}
        description={t("adminCalendar.set", { code: r.lectionary_sets.code })}
      />
      <p className="bg-surface-muted mb-4 rounded-xl p-3 text-sm">{t("adminCalendar.sharedSet")}</p>
      {ranges.length ? (
        <p className="mb-4 text-sm">
          {t("adminCalendar.currentRanges")}:{" "}
          <span className="font-medium">
            {formatRanges(
              ranges,
              (code) => (locale === "ta" ? books.get(code)?.abbrTa : books.get(code)?.abbrEn) ?? code,
            )}
          </span>
        </p>
      ) : null}
      <ReadingForm id={r.id} initial={{ reference: r.reference_display }} />
    </>
  );
}
