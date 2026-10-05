import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { initPage } from "@/lib/i18n/page";
import { requireRoles } from "@/lib/auth/session";
import { PUBLISHER_ROLES } from "@/lib/auth/roles";
import { adminDb } from "@/lib/admin/data";
import { PageHeader } from "@/components/ui/page-header";
import { BookForm } from "@/components/admin/bible-forms";

type Props = { params: Promise<{ locale: string; code: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminBible");
  return { title: t("editBook"), robots: { index: false } };
}

export default async function EditBookPage({ params }: Props) {
  const locale = await initPage(params);
  const { code } = await params;
  await requireRoles(PUBLISHER_ROLES, { locale, nextPath: `/${locale}/admin/bible/books/${code}` });
  if (!/^[1-3]?[A-Z]{2,3}$/.test(code)) notFound();
  const { data } = await (await adminDb()).from("bible_books").select("*").eq("code", code).maybeSingle();
  if (!data) notFound();
  const b = z
    .object({
      id: z.string(),
      name_en: z.string(),
      name_ta: z.string(),
      full_name_ta: z.string(),
      abbr_en: z.string(),
      abbr_ta: z.string(),
    })
    .parse(data);
  const t = await getTranslations("adminBible");

  return (
    <>
      <PageHeader title={`${b.name_ta} · ${b.name_en}`} description={t("editBook")} />
      <BookForm
        id={b.id}
        initial={{
          nameEn: b.name_en,
          nameTa: b.name_ta,
          fullNameTa: b.full_name_ta,
          abbrEn: b.abbr_en,
          abbrTa: b.abbr_ta,
        }}
      />
    </>
  );
}
