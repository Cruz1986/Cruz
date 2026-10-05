/**
 * The reader's personal library: bookmarks, highlights, notes, favorites and history (pure; unit tested).
 *
 * Items are identified by stable keys, not row ids, so the same item saved on two devices or before
 * signing in merges into one (see supabase/migrations/20261005001100_personal.sql):
 *   verse   "<translation>/<BOOK>/<chapter>/<verse>"   chapter "<translation>/<BOOK>/<chapter>"
 *   prayer / saint: slug
 */
import { z } from "zod";

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type ItemType = "verse" | "prayer" | "saint";
export type FavoriteType = "prayer" | "saint";
export type HistoryType = "chapter" | "prayer" | "saint";

export const HISTORY_LIMIT = 200;
export const NOTE_LIMIT = 10_000;

const at = z.string().datetime({ offset: true });
const itemType = z.enum(["verse", "prayer", "saint"]);
const bookmark = z.object({ type: itemType, key: z.string(), vkey: z.number().int().nullable(), at });
const highlight = z.object({ vkey: z.number().int(), color: z.enum(HIGHLIGHT_COLORS), location: z.string(), at });
const note = z.object({
  type: itemType,
  key: z.string(),
  vkey: z.number().int().nullable(),
  body: z.string().min(1).max(NOTE_LIMIT),
  at,
});
const favorite = z.object({ type: z.enum(["prayer", "saint"]), key: z.string(), at });
const history = z.object({ type: z.enum(["chapter", "prayer", "saint"]), key: z.string(), title: z.string(), at });

export const storeSchema = z.object({
  version: z.literal(1),
  /** The account this data belongs to; null while signed out. */
  owner: z.string().nullable(),
  bookmarks: z.array(bookmark),
  highlights: z.array(highlight),
  notes: z.array(note),
  favorites: z.array(favorite),
  history: z.array(history),
});

export type Store = z.infer<typeof storeSchema>;
export type Bookmark = Store["bookmarks"][number];
export type Highlight = Store["highlights"][number];
export type Note = Store["notes"][number];
export type Favorite = Store["favorites"][number];
export type HistoryEntry = Store["history"][number];
export type Collection = "bookmarks" | "highlights" | "notes" | "favorites" | "history";

export const emptyStore = (owner: string | null = null): Store => ({
  version: 1,
  owner,
  bookmarks: [],
  highlights: [],
  notes: [],
  favorites: [],
  history: [],
});

const KEY_PATTERNS: Record<ItemType | HistoryType, RegExp> = {
  verse: /^[a-z0-9-]+\/[A-Z0-9]+\/\d{1,3}\/\d{1,3}$/,
  chapter: /^[a-z0-9-]+\/[A-Z0-9]+\/\d{1,3}$/,
  prayer: /^[a-z0-9]+(-[a-z0-9]+)*$/,
  saint: /^[a-z0-9]+(-[a-z0-9]+)*$/,
};

/** Same rule as private.valid_entity_key() in the database. */
export function validKey(type: ItemType | HistoryType, key: string): boolean {
  return KEY_PATTERNS[type].test(key) && key.length <= 120;
}

export const verseKey = (translation: string, book: string, chapter: number, verse: number) =>
  `${translation}/${book.toUpperCase()}/${chapter}/${verse}`;
export const chapterKey = (translation: string, book: string, chapter: number) =>
  `${translation}/${book.toUpperCase()}/${chapter}`;

export function parseLocation(
  key: string,
): { translation: string; book: string; chapter: number; verse: number | null } | null {
  const m = key.match(/^([a-z0-9-]+)\/([A-Z0-9]+)\/(\d{1,3})(?:\/(\d{1,3}))?$/);
  return m ? { translation: m[1], book: m[2], chapter: Number(m[3]), verse: m[4] ? Number(m[4]) : null } : null;
}

/** Reads stored JSON, dropping anything malformed instead of failing. */
export function parseStore(raw: string | null): Store {
  if (!raw) return emptyStore();
  try {
    const value: unknown = JSON.parse(raw);
    const parsed = storeSchema.safeParse(value);
    if (parsed.success) return clean(parsed.data);
    // Keep the valid items of a partly broken store.
    const base = emptyStore(
      typeof value === "object" && value && typeof (value as { owner?: unknown }).owner === "string"
        ? (value as { owner: string }).owner
        : null,
    );
    const pick = <K extends Collection>(name: K) => {
      const list = (value as Record<string, unknown>)?.[name];
      const item = storeSchema.shape[name].element;
      return (Array.isArray(list) ? list.flatMap((x) => (item.safeParse(x).success ? [x] : [])) : []) as Store[K];
    };
    return clean({
      ...base,
      bookmarks: pick("bookmarks"),
      highlights: pick("highlights"),
      notes: pick("notes"),
      favorites: pick("favorites"),
      history: pick("history"),
    });
  } catch {
    return emptyStore();
  }
}

function clean(store: Store): Store {
  return {
    ...store,
    bookmarks: store.bookmarks.filter((b) => validKey(b.type, b.key)),
    highlights: store.highlights.filter((h) => validKey("verse", h.location)),
    notes: store.notes.filter((n) => validKey(n.type, n.key)),
    favorites: store.favorites.filter((f) => validKey(f.type, f.key)),
    history: store.history.filter((h) => validKey(h.type, h.key)).slice(0, HISTORY_LIMIT),
  };
}

/** Identity of an item within its collection. */
export function identity(collection: Collection, item: Store[Collection][number]): string {
  if (collection === "highlights") return String((item as Highlight).vkey);
  const { type, key } = item as { type: string; key: string };
  return `${type}:${key}`;
}

const newest = <T extends { at: string }>(items: T[]) => [...items].sort((a, b) => b.at.localeCompare(a.at));

/** Adds or replaces an item (by identity), newest first. */
export function upsert<C extends Collection>(store: Store, collection: C, item: Store[C][number]): Store {
  const id = identity(collection, item);
  const rest = (store[collection] as Store[C][number][]).filter((x) => identity(collection, x) !== id);
  const list = newest([item, ...rest] as { at: string }[]) as Store[C];
  return { ...store, [collection]: collection === "history" ? list.slice(0, HISTORY_LIMIT) : list };
}

export function remove<C extends Collection>(store: Store, collection: C, item: Store[C][number]): Store {
  const id = identity(collection, item);
  return {
    ...store,
    [collection]: (store[collection] as Store[C][number][]).filter((x) => identity(collection, x) !== id),
  };
}

export function has<C extends Collection>(store: Store, collection: C, id: string): boolean {
  return (store[collection] as Store[C][number][]).some((x) => identity(collection, x) === id);
}

export type MergeResult = { store: Store; push: { [C in Collection]: Store[C] } };

/**
 * Combines this device's items with the account's. For the same item the newer one wins.
 * `push` lists the local items the account does not have yet (or has an older version of).
 */
export function merge(local: Store, remote: Omit<Store, "version" | "owner">, owner: string): MergeResult {
  const store = emptyStore(owner);
  const push = { bookmarks: [], highlights: [], notes: [], favorites: [], history: [] } as MergeResult["push"];
  for (const collection of ["bookmarks", "highlights", "notes", "favorites", "history"] as const) {
    const byId = new Map<string, { at: string }>();
    for (const item of remote[collection] as { at: string }[]) byId.set(identity(collection, item as never), item);
    for (const item of local[collection] as { at: string }[]) {
      const id = identity(collection, item as never);
      const theirs = byId.get(id);
      if (!theirs || item.at > theirs.at) {
        byId.set(id, item);
        (push[collection] as { at: string }[]).push(item);
      }
    }
    const list = newest([...byId.values()]);
    (store[collection] as { at: string }[]) = collection === "history" ? list.slice(0, HISTORY_LIMIT) : list;
  }
  return { store, push };
}
