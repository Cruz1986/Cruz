"use client";

import { useTranslations } from "next-intl";
import { saveBook, saveTranslation } from "@/lib/admin/bible-actions";
import { AdminForm, FieldGroup, SelectField, TextArea, TextField } from "./form-kit";

type Option = { value: string; label: string };

export function TranslationForm({
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
  const t = useTranslations("adminBible");
  const tc = useTranslations("adminCommon");
  return (
    <AdminForm action={saveTranslation} initial={initial} hidden={{ id }}>
      <FieldGroup>
        <TextField name="name" label={t("name")} required />
        <TextField name="shortName" label={t("shortName")} required />
        <TextArea name="description" label={t("description")} rows={3} />
        <TextField name="sortOrder" type="number" label={t("sortOrder")} />
        <SelectField name="sourceId" label={tc("source")} options={sources} />
        <SelectField name="status" label={tc("status")} options={statuses} help={t("statusHelp")} />
      </FieldGroup>
    </AdminForm>
  );
}

export function BookForm({ id, initial }: { id: string; initial: Record<string, string> }) {
  const t = useTranslations("adminBible");
  return (
    <AdminForm action={saveBook} initial={initial} hidden={{ id }}>
      <FieldGroup>
        <TextField name="nameEn" label={t("nameEn")} lang="en" required />
        <TextField name="nameTa" label={t("nameTa")} lang="ta" required />
        <TextField name="fullNameTa" label={t("fullNameTa")} lang="ta" required className="sm:col-span-2" />
        <TextField name="abbrEn" label={t("abbrEn")} lang="en" required />
        <TextField name="abbrTa" label={t("abbrTa")} lang="ta" required />
      </FieldGroup>
    </AdminForm>
  );
}
