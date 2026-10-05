"use client";

import { useTranslations } from "next-intl";
import { saveAnnouncement } from "@/lib/admin/announcement-actions";
import { AdminForm, FieldGroup, TextArea, TextField } from "./form-kit";

export function AnnouncementForm({ id, initial }: { id?: string; initial: Record<string, string> }) {
  const t = useTranslations("adminAnnouncements");
  return (
    <AdminForm action={saveAnnouncement} initial={initial} hidden={id ? { id } : {}}>
      <FieldGroup>
        <TextField name="titleEn" label={t("titleEn")} lang="en" required />
        <TextField name="titleTa" label={t("titleTa")} lang="ta" required />
        <TextArea name="bodyEn" label={t("bodyEn")} lang="en" rows={3} />
        <TextArea name="bodyTa" label={t("bodyTa")} lang="ta" rows={3} />
        <TextField name="url" label={t("url")} help={t("urlHelp")} mono />
        <TextField name="scheduledAt" type="datetime-local" label={t("scheduledAt")} required />
      </FieldGroup>
    </AdminForm>
  );
}
