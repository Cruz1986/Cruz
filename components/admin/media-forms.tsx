"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createMedia, saveMedia } from "@/lib/admin/media-actions";
import { MEDIA_BUCKET, imagePath, imageProblem, type ImageType } from "@/lib/admin/media";
import type { AdminFormState } from "@/lib/admin/fields";
import { getBrowserClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AdminForm, FieldGroup, SelectField, TextField } from "./form-kit";

type Option = { value: string; label: string };
const inputClass = "block w-full rounded-xl border border-border bg-surface px-3 py-2 text-fg";

function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

/**
 * Uploads the file straight from the browser to storage (staff only, by storage policy), then records it.
 * If recording fails, the uploaded file is removed again.
 */
export function MediaUploadForm({ sources, statuses }: { sources: Option[]; statuses: Option[] }) {
  const t = useTranslations("adminMedia");
  const tc = useTranslations("adminCommon");
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<"type" | "size" | "upload" | "read" | null>(null);
  const [state, setState] = useState<AdminFormState>({ status: "idle" });
  const [values, setValues] = useState({
    altEn: "",
    altTa: "",
    attribution: "",
    sourceId: sources[0]?.value ?? "",
    status: "draft",
  });
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function choose(f: File | null) {
    setProblem(f ? imageProblem(f) : null);
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || imageProblem(file)) return;
    startTransition(async () => {
      const db = getBrowserClient();
      let size: { width: number; height: number };
      try {
        size = await readSize(file);
      } catch {
        setProblem("read");
        return;
      }
      const path = imagePath(file.type as ImageType, crypto.randomUUID());
      const upload = db
        ? await db.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        : null;
      if (!upload || upload.error) {
        setProblem("upload");
        return;
      }
      const fd = new FormData();
      Object.entries({
        ...values,
        locale,
        storagePath: path,
        mimeType: file.type,
        bytes: String(file.size),
        width: String(size.width),
        height: String(size.height),
      }).forEach(([k, v]) => fd.set(k, v));
      // Navigates to the new image when it is recorded.
      const result = await createMedia({ status: "idle" }, fd);
      setState(result);
      if (result.status !== "saved") await db!.storage.from(MEDIA_BUCKET).remove([path]);
    });
  }

  const fieldError = (name: string) =>
    state.fieldErrors?.[name] ? <p className="text-lit-red mt-1 text-sm">{tc("fieldError.required")}</p> : null;

  return (
    <form onSubmit={submit} className="space-y-6">
      {problem || state.status !== "idle" ? (
        <p role="alert" className="border-lit-red/40 text-lit-red rounded-xl border p-3 text-sm">
          {problem
            ? t(`problem.${problem}`)
            : tc(`result.${state.status as Exclude<AdminFormState["status"], "idle">}`)}
        </p>
      ) : null}
      <fieldset className="border-border bg-surface grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">
            {t("file")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
              aria-describedby="file-help"
              className={cn(inputClass, "mt-1")}
            />
          </label>
          <p id="file-help" className="text-fg-muted mt-1 text-xs">
            {t("fileHelp")}
          </p>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
            <img src={preview} alt="" className="border-border mt-3 max-h-56 rounded-xl border object-contain" />
          ) : null}
        </div>
        {(["altEn", "altTa"] as const).map((k) => (
          <div key={k}>
            <label className="block text-sm font-medium">
              {t(k)}
              <input
                name={k}
                lang={k === "altTa" ? "ta" : "en"}
                value={values[k]}
                onChange={set(k)}
                aria-describedby="alt-help"
                className={cn(inputClass, "mt-1")}
              />
            </label>
            {k === "altEn" ? fieldError("altEn") : null}
          </div>
        ))}
        <p id="alt-help" className="text-fg-muted -mt-2 text-xs sm:col-span-2">
          {t("altHelp")}
        </p>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium">
            {t("attribution")}
            <input
              value={values.attribution}
              onChange={set("attribution")}
              aria-describedby="attr-help"
              className={cn(inputClass, "mt-1")}
            />
          </label>
          <p id="attr-help" className="text-fg-muted mt-1 text-xs">
            {t("attributionHelp")}
          </p>
        </div>
        <label className="block text-sm font-medium">
          {tc("source")}
          <select value={values.sourceId} onChange={set("sourceId")} className={cn(inputClass, "mt-1")}>
            {sources.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {tc("status")}
          <select value={values.status} onChange={set("status")} className={cn(inputClass, "mt-1")}>
            {statuses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <Button type="submit" disabled={pending || !file || Boolean(problem && problem !== "upload")}>
        {pending ? t("uploading") : t("upload")}
      </Button>
    </form>
  );
}

export function MediaForm({
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
  const t = useTranslations("adminMedia");
  const tc = useTranslations("adminCommon");
  return (
    <AdminForm action={saveMedia} initial={initial} hidden={{ id }}>
      <FieldGroup>
        <TextField name="altEn" label={t("altEn")} lang="en" help={t("altHelp")} />
        <TextField name="altTa" label={t("altTa")} lang="ta" />
        <TextField name="attribution" label={t("attribution")} help={t("attributionHelp")} className="sm:col-span-2" />
        <SelectField name="sourceId" label={tc("source")} options={sources} />
        <SelectField name="status" label={tc("status")} options={statuses} />
      </FieldGroup>
    </AdminForm>
  );
}
