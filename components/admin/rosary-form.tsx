"use client";

import { useTranslations } from "next-intl";
import { saveMystery } from "@/lib/admin/rosary-actions";
import { AdminForm, FieldGroup, SelectField, TextArea, TextField } from "./form-kit";

type Option = { value: string; label: string };

export function MysteryForm({
  id,
  initial,
  sources,
  statuses,
}: {
  id: string;
  initial: Record<string, string>;
  sources: Option[];
  statuses: Option[];
}) {
  const t = useTranslations("adminRosary");
  const tc = useTranslations("adminCommon");
  return (
    <AdminForm action={saveMystery} initial={initial} hidden={{ id }}>
      <FieldGroup>
        <TextField name="titleEn" label={t("titleEn")} lang="en" required />
        <TextField name="titleTa" label={t("titleTa")} lang="ta" required />
        <TextField name="scripture" label={t("scripture")} help={t("scriptureHelp")} />
        <span />
        <TextField name="fruitEn" label={t("fruitEn")} lang="en" />
        <TextField name="fruitTa" label={t("fruitTa")} lang="ta" />
        <TextArea name="meditationEn" label={t("meditationEn")} lang="en" rows={5} />
        <TextArea name="meditationTa" label={t("meditationTa")} lang="ta" rows={5} />
        <SelectField name="sourceId" label={tc("source")} options={sources} />
        <SelectField name="status" label={tc("status")} options={statuses} />
      </FieldGroup>
    </AdminForm>
  );
}
