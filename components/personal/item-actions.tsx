"use client";

import { useEffect, useState } from "react";
import { Heart, NotebookPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { personal, usePersonalStore } from "@/lib/personal/client";
import type { FavoriteType, HistoryType } from "@/lib/personal/store";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "./note-dialog";

export function FavoriteButton({ type, slug }: { type: FavoriteType; slug: string }) {
  const t = useTranslations("personal");
  const store = usePersonalStore();
  const on = store.favorites.some((f) => f.type === type && f.key === slug);
  return (
    <Button
      size="sm"
      variant={on ? "primary" : "secondary"}
      aria-pressed={on}
      onClick={() => personal.toggleFavorite(type, slug)}
    >
      <Heart aria-hidden className={on ? "size-4 fill-current" : "size-4"} />
      {on ? t("favorited") : t("favorite")}
    </Button>
  );
}

/** Note button for a prayer or saint, showing the note below when there is one. */
export function NoteButton({ type, slug, name }: { type: "prayer" | "saint"; slug: string; name: string }) {
  const t = useTranslations("personal");
  const store = usePersonalStore();
  const [open, setOpen] = useState(false);
  const note = store.notes.find((n) => n.type === type && n.key === slug);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <NotebookPen aria-hidden className="size-4" />
        {note ? t("editNote") : t("note")}
      </Button>
      <NoteDialog
        open={open}
        name={name}
        initial={note?.body ?? ""}
        onSave={(body) => personal.saveNote(type, slug, null, body)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** The reader's note on this item, shown on its page. */
export function NoteView({ type, slug }: { type: "prayer" | "saint"; slug: string }) {
  const t = useTranslations("personal");
  const store = usePersonalStore();
  const note = store.notes.find((n) => n.type === type && n.key === slug);
  if (!note) return null;
  return (
    <aside aria-label={t("note")} className="border-accent/30 bg-accent-soft rounded-2xl border p-4">
      <p className="text-fg-muted mb-1 text-sm font-semibold">{t("note")}</p>
      <p className="text-fg whitespace-pre-line">{note.body}</p>
    </aside>
  );
}

/** Adds the page to the reader's history. */
export function RecordVisit({ type, entityKey, title }: { type: HistoryType; entityKey: string; title: string }) {
  useEffect(() => {
    personal.recordVisit(type, entityKey, title);
  }, [type, entityKey, title]);
  return null;
}
