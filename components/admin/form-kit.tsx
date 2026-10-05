"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminFormState } from "@/lib/admin/fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Building blocks for admin forms: a form bound to a server action (adminSave) whose fields are
 * controlled, so values stay as typed after saving, with per-field errors and a result banner.
 */
type Values = Record<string, string>;
type Ctx = { values: Values; set: (name: string, value: string) => void; errors: Record<string, string> };
const FormContext = createContext<Ctx | null>(null);

const inputClass = "block w-full rounded-xl border border-border bg-surface px-3 py-2 text-fg";

function useField(name: string) {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("Field used outside AdminForm");
  return { value: ctx.values[name] ?? "", set: (v: string) => ctx.set(name, v), error: ctx.errors[name] };
}

export function AdminForm({
  action,
  initial,
  hidden = {},
  children,
  submitLabel,
}: {
  action: (state: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  initial: Values;
  hidden?: Record<string, string>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const t = useTranslations("adminCommon");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [values, setValues] = useState(initial);
  const errors = state.fieldErrors ?? {};

  return (
    <FormContext.Provider value={{ values, set: (n, v) => setValues((s) => ({ ...s, [n]: v })), errors }}>
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="locale" value={locale} />
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
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
        {children}
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : (submitLabel ?? t("save"))}
        </Button>
      </form>
    </FormContext.Provider>
  );
}

export function FieldGroup({
  legend,
  children,
  className,
}: {
  legend?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("border-border bg-surface grid gap-4 rounded-2xl border p-4 sm:grid-cols-2", className)}>
      {legend ? <legend className="px-1 font-semibold">{legend}</legend> : null}
      {children}
    </fieldset>
  );
}

function ErrorText({ name, code }: { name: string; code?: string }) {
  const t = useTranslations("adminCommon");
  if (!code) return null;
  const known = ["required", "too_long", "invalid_date", "invalid_reference", "invalid_url", "feast_incomplete"];
  return (
    <p id={`${name}-error`} className="text-lit-red mt-1 text-sm">
      {t(`fieldError.${known.includes(code) ? code : "invalid"}` as "fieldError.invalid")}
    </p>
  );
}

type Common = { name: string; label: string; help?: string; lang?: string; required?: boolean; className?: string };

function describedBy(name: string, error?: string, help?: string) {
  return error ? `${name}-error` : help ? `${name}-help` : undefined;
}

export function TextField({ type = "text", mono, ...p }: Common & { type?: string; mono?: boolean }) {
  const f = useField(p.name);
  return (
    <div className={p.className}>
      <label className="block text-sm font-medium">
        {p.label}
        <input
          name={p.name}
          type={type}
          lang={p.lang}
          required={p.required}
          value={f.value}
          onChange={(e) => f.set(e.target.value)}
          aria-invalid={Boolean(f.error)}
          aria-describedby={describedBy(p.name, f.error, p.help)}
          className={cn(inputClass, "mt-1", mono && "font-mono")}
        />
      </label>
      {p.help ? (
        <p id={`${p.name}-help`} className="text-fg-muted mt-1 text-xs">
          {p.help}
        </p>
      ) : null}
      <ErrorText name={p.name} code={f.error} />
    </div>
  );
}

export function TextArea({ rows = 8, ...p }: Common & { rows?: number }) {
  const f = useField(p.name);
  return (
    <div className={cn("sm:col-span-2", p.className)}>
      <label className="block text-sm font-medium">
        {p.label}
        <textarea
          name={p.name}
          lang={p.lang}
          rows={rows}
          required={p.required}
          value={f.value}
          onChange={(e) => f.set(e.target.value)}
          aria-invalid={Boolean(f.error)}
          aria-describedby={describedBy(p.name, f.error, p.help)}
          className={cn(inputClass, "mt-1 leading-relaxed")}
        />
      </label>
      {p.help ? (
        <p id={`${p.name}-help`} className="text-fg-muted mt-1 text-xs">
          {p.help}
        </p>
      ) : null}
      <ErrorText name={p.name} code={f.error} />
    </div>
  );
}

export function SelectField({ options, ...p }: Common & { options: { value: string; label: string }[] }) {
  const f = useField(p.name);
  return (
    <div className={p.className}>
      <label className="block text-sm font-medium">
        {p.label}
        <select
          name={p.name}
          value={f.value}
          onChange={(e) => f.set(e.target.value)}
          aria-invalid={Boolean(f.error)}
          aria-describedby={describedBy(p.name, f.error, p.help)}
          className={cn(inputClass, "mt-1")}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {p.help ? (
        <p id={`${p.name}-help`} className="text-fg-muted mt-1 text-xs">
          {p.help}
        </p>
      ) : null}
      <ErrorText name={p.name} code={f.error} />
    </div>
  );
}

export function CheckboxField({ name, label, help }: { name: string; label: string; help?: string }) {
  const f = useField(name);
  return (
    <div className="sm:col-span-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name={name}
          checked={f.value === "on"}
          onChange={(e) => f.set(e.target.checked ? "on" : "")}
          aria-describedby={help ? `${name}-help` : undefined}
          className="size-5"
        />
        {label}
      </label>
      {help ? (
        <p id={`${name}-help`} className="text-fg-muted mt-1 text-xs">
          {help}
        </p>
      ) : null}
    </div>
  );
}
