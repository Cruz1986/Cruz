"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

/** Accessible single-choice control built on native radio inputs. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="border-border bg-surface-muted inline-flex flex-wrap rounded-full border p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "has-[:focus-visible]:outline-focus cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3",
              option.value === value ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
