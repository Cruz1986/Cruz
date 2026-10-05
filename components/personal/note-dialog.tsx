"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NOTE_LIMIT } from "@/lib/personal/store";
import { Button } from "@/components/ui/button";

/** A modal editor for one private note. Saving an empty note deletes it. */
export function NoteDialog({
  open,
  name,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  name: string;
  initial: string;
  onSave: (body: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="bg-surface text-fg border-border m-auto w-[min(100%-2rem,36rem)] rounded-2xl border p-0 backdrop:bg-black/40"
    >
      {open ? <NoteForm titleId={titleId} name={name} initial={initial} onSave={onSave} onClose={onClose} /> : null}
    </dialog>
  );
}

function NoteForm({
  titleId,
  name,
  initial,
  onSave,
  onClose,
}: {
  titleId: string;
  name: string;
  initial: string;
  onSave: (body: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("personal");
  const helpId = useId();
  const [body, setBody] = useState(initial);
  return (
    <form
      method="dialog"
      className="space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(body);
        onClose();
      }}
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {t("noteFor", { name })}
      </h2>
      <textarea
        autoFocus
        rows={8}
        maxLength={NOTE_LIMIT}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label={t("note")}
        aria-describedby={helpId}
        placeholder={t("notePlaceholder")}
        className="border-border bg-bg block w-full rounded-xl border p-3"
      />
      <p id={helpId} className="text-fg-muted text-xs">
        {t("noteHelp")}
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        {initial ? (
          <Button
            variant="ghost"
            className="text-lit-red mr-auto"
            onClick={() => {
              onSave("");
              onClose();
            }}
          >
            {t("delete")}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit">{t("save")}</Button>
      </div>
    </form>
  );
}
