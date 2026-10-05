"use client";

import { useTranslations } from "next-intl";
import { saveReflection } from "@/lib/admin/reflection-actions";
import { AdminForm, FieldGroup, SelectField, TextArea, TextField } from "./form-kit";

type Option = { value: string; label: string };

export function ReflectionForm({
  id,
  initial,
  sources,
  statuses,
}: {
  id?: string;
  initial: Record<string, string>;
  sources: Option[];
  statuses: Option[];
}) {
  const t = useTranslations("adminReflections");
  const tc = useTranslations("adminCommon");
  return (
    <AdminForm action={saveReflection} initial={initial} hidden={id ? { id } : {}}>
      <FieldGroup>
        <TextField name="date" type="date" label={t("date")} required />
        <SelectField
          name="language"
          label={t("language")}
          options={[
            { value: "ta", label: tc("tamil") },
            { value: "en", label: tc("english") },
          ]}
        />
        <TextField name="title" label={t("heading")} required className="sm:col-span-2" />
        <TextArea name="body" label={t("body")} rows={14} required help={t("bodyHelp")} />
        <TextField name="author" label={t("author")} required />
        <SelectField name="sourceId" label={tc("source")} options={sources} />
        <SelectField name="status" label={tc("status")} options={statuses} help={t("onePublished")} />
      </FieldGroup>
    </AdminForm>
  );
}
