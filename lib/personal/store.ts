/**
 * The reader's personal library: bookmarks, highlights, notes, favorites and history (pure; unit tested).
 *
 * Items are identified by stable keys, not row ids, so the same item saved on two devices or before
 * signing in merges into one (see supabase/migrations/20261005001100_personal.sql):
 *   verse   "<translation>/<BOOK>/<chapter>/<verse>"   chapter "<translation>/<BOOK>/<chapter>"
 *   prayer / saint: slug
 */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export type ItemType = "verse" | "prayer" | "saint";
export type FavoriteType = "prayer" | "saint";
export type HistoryType = "chapter" | "prayer" | "saint";

export const HISTORY_LIMIT = 200;
export const NOTE_LIMIT = 10_000;

export type Bookmark = { type: ItemType; key: string; vkey: number | null; at: string };
export type Highlight = { vkey: number; color: HighlightColor; location: string; at: string };
export type Note = { type: ItemType; key: string; vkey: number | null; body: string; at: string };
export type Favorite = { type: FavoriteType; key: string; at: string };
export type HistoryEntry = { type: HistoryType; key: string; title: string; at: string };
export type Store = {
  version: 1;
  /** The account this data belongs to; null while signed out. */
  owner: string | null;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  notes: Note[];
  favorites: Favorite[];
  history: HistoryEntry[];
};
export type Collection = "bookmarks" | "highlights" | "notes" | "favorites" | "history";

// Small hand-written checks: this module runs on every page, so it avoids a validation library.
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isAt = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v)) && /T/.test(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);
const ITEM_TYPES = ["verse", "prayer", "saint"] as const;

export const ITEM_CHECKS: { [C in Collection]: (v: unknown) => v is Store[C][number] } = {
  bookmarks: (v): v is Bookmark =>
    isObj(v) &&
    oneOf(v.type, ITEM_TYPES) &&
    typeof v.key === "string" &&
    (v.vkey === null || isInt(v.vkey)) &&
    isAt(v.at),
  highlights: (v): v is Highlight =>
    isObj(v) && isInt(v.vkey) && oneOf(v.color, HIGHLIGHT_COLORS) && typeof v.location === "string" && isAt(v.at),
  notes: (v): v is Note =>
    isObj(v) &&
    oneOf(v.type, ITEM_TYPES) &&
    typeof v.key === "string" &&
    (v.vkey === null || isInt(v.vkey)) &&
    typeof v.body === "string" &&
    v.body.length >= 1 &&
    v.body.length <= NOTE_LIMIT &&
    isAt(v.at),
  favorites: (v): v is Favorite =>
    isObj(v) && oneOf(v.type, ["prayer", "saint"] as const) && typeof v.key === "string" && isAt(v.at),
  history: (v): v is HistoryEntry =>
    isObj(v) &&
    oneOf(v.type, ["chapter", "prayer", "saint"] as const) &&
    typeof v.key === "string" &&
    typeof v.title === "string" &&
    isAt(v.at),
};

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

/** Reads stored JSON, keeping every valid item and dropping anything malformed instead of failing. */
export function parseStore(raw: string | null): Store {
  if (!raw) return emptyStore();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isObj(value)) return emptyStore();
    const pick = <C extends Collection>(name: C) => {
      const list = value[name];
      return (Array.isArray(list) ? list.filter(ITEM_CHECKS[name]) : []) as Store[C];
    };
    return clean({
      version: 1,
      owner: typeof value.owner === "string" ? value.owner : null,
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
