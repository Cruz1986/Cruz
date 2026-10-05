"use client";

import { useTranslations } from "next-intl";
import { saveCelebration, saveDay, saveReading } from "@/lib/admin/calendar-actions";
import { AdminForm, CheckboxField, FieldGroup, SelectField, TextArea, TextField } from "./form-kit";

const COLORS = ["green", "violet", "white", "red", "rose", "black", "gold"] as const;
type Option = { value: string; label: string };

function useColors(): Option[] {
  const t = useTranslations("liturgicalColor");
  return COLORS.map((c) => ({ value: c, label: t(c) }));
}

export function DayForm({ id, date, initial }: { id: string; date: string; initial: Record<string, string> }) {
  const t = useTranslations("adminCalendar");
  return (
    <AdminForm action={saveDay} initial={initial} hidden={{ id, date }}>
      <FieldGroup>
        <TextField name="titleEn" label={t("titleEn")} lang="en" required />
        <TextField name="titleTa" label={t("titleTa")} lang="ta" required />
        <SelectField name="color" label={t("color")} options={useColors()} />
        <span />
        <TextArea name="notesEn" label={t("notesEn")} lang="en" rows={2} />
        <TextArea name="notesTa" label={t("notesTa")} lang="ta" rows={2} />
        <CheckboxField name="isOverride" label={t("keep")} help={t("keepHelp")} />
      </FieldGroup>
    </AdminForm>
  );
}

export function CelebrationForm({
  id,
  initial,
  saints,
}: {
  id: string;
  initial: Record<string, string>;
  saints: Option[];
}) {
  const t = useTranslations("adminCalendar");
  return (
    <AdminForm action={saveCelebration} initial={initial} hidden={{ id }}>
      <FieldGroup>
        <TextField name="nameEn" label={t("nameEn")} lang="en" required className="sm:col-span-2" />
        <TextField name="nameTa" label={t("nameTa")} lang="ta" required className="sm:col-span-2" />
        <SelectField name="color" label={t("color")} options={useColors()} />
        <SelectField name="saintId" label={t("saint")} options={[{ value: "", label: t("noSaint") }, ...saints]} />
      </FieldGroup>
    </AdminForm>
  );
}

export function ReadingForm({ id, initial }: { id: string; initial: Record<string, string> }) {
  const t = useTranslations("adminCalendar");
  return (
    <AdminForm action={saveReading} initial={initial} hidden={{ id }}>
      <FieldGroup>
        <TextField
          name="reference"
          label={t("reference")}
          help={t("referenceHelp")}
          required
          className="sm:col-span-2"
        />
      </FieldGroup>
    </AdminForm>
  );
}
