"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveSaint, type SaintFormState } from "@/lib/admin/saint-actions";
import type { ContentStatus } from "@/lib/admin/prayer-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export type SaintFormInitial = {
  id?: string;
  slug: string;
  sourceId: string;
  status: ContentStatus;
  nameEn: string;
  nameTa: string;
  titleEn: string;
  titleTa: string;
  feastMonth: string;
  feastDay: string;
  birthYear: string;
  deathYear: string;
  patronageEn: string;
  patronageTa: string;
  biographyEn: string;
  biographyTa: string;
  imageMediaId: string;
};

type Option = { value: string; label: string };
type TextField = Exclude<keyof SaintFormInitial, "id" | "status">;

const inputClass = "block w-full rounded-xl border border-border bg-surface px-3 py-2 text-fg";
const KNOWN_ERRORS = ["feast_incomplete", "feast_invalid", "years_order", "biography_required"];

export function SaintForm({
  initial,
  sources,
  statuses,
  monthNames,
  images = [],
}: {
  initial: SaintFormInitial;
  sources: Option[];
  statuses: { value: ContentStatus; label: string }[];
  monthNames: string[];
  images?: Option[];
}) {
  const t = useTranslations("adminSaints");
  const tp = useTranslations("adminPrayers");
  const locale = useLocale();
  const [state, action, pending] = useActionState<SaintFormState, FormData>(saveSaint, { status: "idle" });
  const [values, setValues] = useState(initial);
  const set = (key: keyof SaintFormInitial) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const errorId = (field: string) => (state.fieldErrors?.[field] ? `${field}-error` : undefined);
  const error = (field: string) => {
    const code = state.fieldErrors?.[field];
    if (!code) return null;
    return (
      <p id={`${field}-error`} className="text-lit-red mt-1 text-sm">
        {t(`fieldError.${KNOWN_ERRORS.includes(code) ? code : "invalid"}` as "fieldError.invalid")}
      </p>
    );
  };

  const text = (field: TextField, label: string, opts: { lang?: string; required?: boolean; type?: string } = {}) => (
    <div>
      <label className="block text-sm font-medium">
        {label}
        <input
          name={field}
          lang={opts.lang}
          type={opts.type ?? "text"}
          required={opts.required}
          value={values[field]}
          onChange={set(field)}
          aria-invalid={Boolean(state.fieldErrors?.[field])}
          aria-describedby={errorId(field)}
          className={cn(inputClass, "mt-1", field === "slug" && "font-mono")}
        />
      </label>
      {error(field)}
    </div>
  );

  const languages = [
    { key: "En" as const, lang: "en", label: tp("form.english") },
    { key: "Ta" as const, lang: "ta", label: tp("form.tamil") },
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
          {state.status === "slug_taken" ? t("slugTaken") : tp(`result.${state.status}`)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {languages.map(({ key, lang, label }) => (
          <fieldset key={key} className="border-border bg-surface space-y-3 rounded-2xl border p-4">
            <legend className="px-1 font-semibold">{label}</legend>
            {text(`name${key}`, t("form.name"), { lang, required: true })}
            {text(`title${key}`, t("form.title"), { lang })}
            {text(`patronage${key}`, t("form.patronage"), { lang })}
            <div>
              <label className="block text-sm font-medium">
                {t("form.biography")}
                <textarea
                  name={`biography${key}`}
                  lang={lang}
                  rows={12}
                  value={values[`biography${key}`]}
                  onChange={set(`biography${key}`)}
                  aria-invalid={Boolean(state.fieldErrors?.[`biography${key}`])}
                  aria-describedby={errorId(`biography${key}`) ?? "biography-help"}
                  className={cn(inputClass, "mt-1 font-serif leading-relaxed")}
                />
              </label>
              {error(`biography${key}`)}
            </div>
          </fieldset>
        ))}
      </div>
      <p id="biography-help" className="text-fg-muted text-xs">
        {t("form.biographyHelp")}
      </p>

      <div className="border-border bg-surface grid gap-4 rounded-2xl border p-4 sm:grid-cols-2">
        <div>
          {text("slug", tp("form.slug"), { required: true })}
          <span className="text-fg-muted mt-1 block text-xs">{t("form.slugHelp")}</span>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">{t("form.feast")}</legend>
          <div className="mt-1 flex gap-2">
            <select
              name="feastMonth"
              aria-label={t("form.feastMonth")}
              value={values.feastMonth}
              onChange={set("feastMonth")}
              className={inputClass}
            >
              <option value="">—</option>
              {monthNames.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
            <input
              name="feastDay"
              type="number"
              min={1}
              max={31}
              aria-label={t("form.feastDay")}
              value={values.feastDay}
              onChange={set("feastDay")}
              aria-invalid={Boolean(state.fieldErrors?.feastDay)}
              aria-describedby={errorId("feastDay")}
              className={cn(inputClass, "w-24")}
            />
          </div>
          {error("feastDay")}
        </fieldset>
        {text("birthYear", t("form.born"), { type: "number" })}
        {text("deathYear", t("form.died"), { type: "number" })}
        <label className="block text-sm font-medium">
          {t("form.image")}
          <select
            name="imageMediaId"
            value={values.imageMediaId}
            onChange={set("imageMediaId")}
            className={cn(inputClass, "mt-1")}
          >
            <option value="">{t("form.noImage")}</option>
            {images.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {tp("form.source")}
          <select name="sourceId" value={values.sourceId} onChange={set("sourceId")} className={cn(inputClass, "mt-1")}>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {tp("form.status")}
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
        {pending ? tp("form.saving") : tp("form.save")}
      </Button>
    </form>
  );
}
