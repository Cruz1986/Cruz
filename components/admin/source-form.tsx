"use client";

import { useTranslations } from "next-intl";
import { saveSource } from "@/lib/admin/source-actions";
import { LICENSE_TYPES, PERMISSION_STATUSES } from "@/lib/admin/fields";
import { AdminForm, FieldGroup, SelectField, TextArea, TextField } from "./form-kit";

export function SourceForm({ initial, id }: { initial: Record<string, string>; id?: string }) {
  const t = useTranslations("adminSources");
  return (
    <AdminForm action={saveSource} initial={initial} hidden={id ? { id } : {}}>
      <FieldGroup>
        <TextField name="name" label={t("name")} required className="sm:col-span-2" />
        <TextField name="copyrightHolder" label={t("copyrightHolder")} />
        <TextField name="licenseUrl" label={t("licenseUrl")} type="url" />
        <SelectField
          name="licenseType"
          label={t("licenseType")}
          options={LICENSE_TYPES.map((v) => ({ value: v, label: t(`licenseTypes.${v}`) }))}
        />
        <SelectField
          name="permissionStatus"
          label={t("permissionStatus")}
          options={PERMISSION_STATUSES.map((v) => ({ value: v, label: t(`permission.${v}`) }))}
        />
        <TextField name="attribution" label={t("attribution")} className="sm:col-span-2" />
        <TextField name="approval" label={t("approval")} className="sm:col-span-2" />
        <TextArea name="notes" label={t("notes")} rows={4} />
      </FieldGroup>
    </AdminForm>
  );
}
