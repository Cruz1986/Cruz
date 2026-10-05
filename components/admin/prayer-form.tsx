"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { savePrayer, type PrayerFormState } from "@/lib/admin/prayer-actions";
import type { ContentStatus } from "@/lib/admin/prayer-form";
import { Button } from "@/components/ui/button";
import { PrayerText } from "@/components/prayers/prayer-text";
import { cn } from "@/lib/cn";

export type PrayerFormInitial = {
  id?: string;
  slug: string;
  categoryId: string;
  sourceId: string;
  sortOrder: number;
  status: ContentStatus;
  titleEn: string;
  bodyEn: string;
  titleTa: string;
  bodyTa: string;
};

type Option = { value: string; label: string };

const inputClass = "block w-full rounded-xl border border-border bg-surface px-3 py-2 text-fg";

export function PrayerForm({
  initial,
  categories,
  sources,
  statuses,
}: {
  initial: PrayerFormInitial;
  categories: Option[];
  sources: Option[];
  statuses: { value: ContentStatus; label: string }[];
}) {
  const t = useTranslations("adminPrayers");
  const locale = useLocale();
  const [state, action, pending] = useActionState<PrayerFormState, FormData>(savePrayer, { status: "idle" });
  const [values, setValues] = useState(initial);
  const set = (key: keyof PrayerFormInitial) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const error = (field: string) => {
    const code = state.fieldErrors?.[field];
    if (!code) return null;
    const key = code === "language_required" || code === "title_and_text_together" ? code : "invalid";
    return (
      <p id={`${field}-error`} className="text-lit-red mt-1 text-sm">
        {t(`fieldError.${key}`)}
      </p>
    );
  };
  const described = (field: string) => (state.fieldErrors?.[field] ? `${field}-error` : undefined);

  const languages = [
    { key: "En" as const, lang: "en", label: t("form.english") },
    { key: "Ta" as const, lang: "ta", label: t("form.tamil") },
  ];

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {state.status !== "idle" ? (
        <p
          role={state.status === "saved" ? "status" : "alert"}
          className={cn(
            "rounded-xl p-3 text-sm",
            state.status === "saved" ? "bg-accent-soft text-fg" : "border-lit-red/40 text-lit-red border",
          )}
        >
          {t(`result.${state.status}`)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {languages.map(({ key, lang, label }) => (
          <fieldset key={key} className="border-border bg-surface space-y-3 rounded-2xl border p-4">
            <legend className="px-1 font-semibold">{label}</legend>
            <label className="block text-sm font-medium">
              {t("form.title")}
              <input
                name={`title${key}`}
                lang={lang}
                value={values[`title${key}`]}
                onChange={set(`title${key}`)}
                aria-invalid={Boolean(state.fieldErrors?.[`title${key}`])}
                aria-describedby={described(`title${key}`)}
                className={cn(inputClass, "mt-1")}
              />
            </label>
            {error(`title${key}`)}
            <label className="block text-sm font-medium">
              {t("form.text")}
              <textarea
                name={`body${key}`}
                lang={lang}
                rows={12}
                value={values[`body${key}`]}
                onChange={set(`body${key}`)}
                aria-describedby={`body${key}-help`}
                className={cn(inputClass, "mt-1 font-serif leading-relaxed")}
              />
            </label>
            <p id={`body${key}-help`} className="text-fg-muted text-xs">
              {t("form.textHelp")}
            </p>
            {values[`body${key}`].trim() ? (
              <details className="bg-surface-muted rounded-xl p-3">
                <summary className="cursor-pointer text-sm font-medium">{t("form.preview")}</summary>
                <PrayerText text={values[`body${key}`]} language={lang} className="mt-3" />
              </details>
            ) : null}
          </fieldset>
        ))}
      </div>

      <div className="border-border bg-surface grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {t("form.slug")}
          <input
            name="slug"
            required
            value={values.slug}
            onChange={set("slug")}
            aria-invalid={Boolean(state.fieldErrors?.slug)}
            aria-describedby={described("slug") ?? "slug-help"}
            className={cn(inputClass, "mt-1 font-mono")}
          />
          <span id="slug-help" className="text-fg-muted mt-1 block text-xs font-normal">
            {t("form.slugHelp")}
          </span>
        </label>
        {error("slug")}
        <label className="block text-sm font-medium">
          {t("form.category")}
          <select
            name="categoryId"
            value={values.categoryId}
            onChange={set("categoryId")}
            className={cn(inputClass, "mt-1")}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t("form.source")}
          <select name="sourceId" value={values.sourceId} onChange={set("sourceId")} className={cn(inputClass, "mt-1")}>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {t("form.sortOrder")}
          <input
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            value={values.sortOrder}
            onChange={set("sortOrder")}
            className={cn(inputClass, "mt-1")}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("form.status")}
          <select name="status" value={values.status} onChange={set("status")} className={cn(inputClass, "mt-1")}>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? t("form.saving") : t("form.save")}
      </Button>
    </form>
  );
}
