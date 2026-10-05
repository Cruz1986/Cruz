"use client";

import { useSyncExternalStore } from "react";
import type { BrowserClient } from "@/lib/db/browser";
import {
  emptyStore,
  merge,
  parseStore,
  remove,
  upsert,
  type Collection,
  type HighlightColor,
  type ItemType,
  type FavoriteType,
  type HistoryType,
  type Store,
} from "./store";

/**
 * The personal library in the browser. Kept in local storage so it works without an account;
 * when the reader is signed in, every change is also written to their account and, on each visit,
 * the device and the account are merged (lib/personal/store.ts › merge).
 */
const KEY = "personal:v1";
const EVENT = "personal-change";
const LEGACY_FAVORITES = "prayers:favorites";
const LEGACY_POSITION = "bible:last";

export type SyncStatus = "local" | "syncing" | "synced" | "error";

let cached: { raw: string | null; store: Store } = { raw: null, store: emptyStore() };
let account: { userId: string | null; status: SyncStatus } = { userId: null, status: "local" };
const statusListeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function read(): Store {
  const raw = readRaw();
  if (raw !== cached.raw) cached = { raw, store: parseStore(raw) };
  return cached.store;
}

function write(store: Store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage full or unavailable: the change lasts for this page only
    cached = { raw: cached.raw, store };
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function setAccount(next: Partial<typeof account>) {
  account = { ...account, ...next };
  for (const listener of statusListeners) listener();
}

const EMPTY = emptyStore();
export function usePersonalStore(): Store {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useSyncState(): typeof account {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => account,
    () => account,
  );
}

type Sync = typeof import("./sync");
let accountCode: Promise<{ db: BrowserClient | null; sync: Sync }> | null = null;

/**
 * The account side (Supabase client and sync) is loaded only for signed-in readers, so pages stay light for
 * everyone else.
 */
function loadAccountCode() {
  accountCode ??= Promise.all([import("@/lib/db/browser"), import("./sync")]).then(([browser, sync]) => ({
    db: browser.getBrowserClient(),
    sync,
  }));
  return accountCode;
}

/** A Supabase session cookie (possibly split into chunks) is present. */
export function hasSessionCookie(): boolean {
  return /(^|;\s*)sb-[^=;]+-auth-token(\.\d+)?=/.test(document.cookie);
}

/** Writes to the account in the background; the device copy is already saved. */
function remote(task: (db: BrowserClient, userId: string, sync: Sync) => Promise<void>) {
  const userId = account.userId;
  if (!userId) return;
  loadAccountCode()
    .then(({ db, sync }) => (db ? task(db, userId, sync) : undefined))
    .then(
      () => setAccount({ status: "synced" }),
      () => setAccount({ status: "error" }),
    );
}

function save<C extends Collection>(collection: C, item: Store[C][number]) {
  write(upsert(read(), collection, item));
  remote((db, userId, sync) => sync.pushItems(db, userId, collection, [item] as Store[C]));
}

function drop<C extends Collection>(collection: C, item: Store[C][number]) {
  write(remove(read(), collection, item));
  remote((db, _userId, sync) => sync.deleteItem(db, collection, item));
}

const now = () => new Date().toISOString();

export const personal = {
  toggleBookmark(type: ItemType, key: string, vkey: number | null = null) {
    const existing = read().bookmarks.find((b) => b.type === type && b.key === key);
    if (existing) drop("bookmarks", existing);
    else save("bookmarks", { type, key, vkey, at: now() });
  },
  setHighlight(vkey: number, location: string, color: HighlightColor | null) {
    const existing = read().highlights.find((h) => h.vkey === vkey);
    if (color === null) {
      if (existing) drop("highlights", existing);
    } else save("highlights", { vkey, location, color, at: now() });
  },
  saveNote(type: ItemType, key: string, vkey: number | null, body: string) {
    const text = body.trim();
    const existing = read().notes.find((n) => n.type === type && n.key === key);
    if (!text) {
      if (existing) drop("notes", existing);
    } else save("notes", { type, key, vkey, body: text, at: now() });
  },
  toggleFavorite(type: FavoriteType, key: string) {
    const existing = read().favorites.find((f) => f.type === type && f.key === key);
    if (existing) drop("favorites", existing);
    else save("favorites", { type, key, at: now() });
  },
  recordVisit(type: HistoryType, key: string, title: string) {
    const last = read().history[0];
    // Re-opening the same page within a minute is not a new visit.
    if (last && last.type === type && last.key === key && Date.now() - Date.parse(last.at) < 60_000) return;
    save("history", { type, key, title, at: now() });
  },
  remove<C extends Collection>(collection: C, item: Store[C][number]) {
    drop(collection, item);
  },
  clear(collection: Collection) {
    write({ ...read(), [collection]: [] });
    remote((db, _userId, sync) => sync.clearCollection(db, collection));
  },
  /** Forgets the account's data on this device (on sign-out). */
  forgetDevice() {
    write(emptyStore());
    setAccount({ userId: null, status: "local" });
  },
};

/** Brings data saved by earlier versions of the app into the library, once. */
function migrateLegacy() {
  try {
    const favorites = window.localStorage.getItem(LEGACY_FAVORITES);
    const position = window.localStorage.getItem(LEGACY_POSITION);
    if (!favorites && !position) return;
    let store = read();
    const at = now();
    const slugs: unknown = favorites ? JSON.parse(favorites) : [];
    if (Array.isArray(slugs))
      for (const slug of slugs)
        if (typeof slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
          store = upsert(store, "favorites", { type: "prayer", key: slug, at });
    const last: unknown = position ? JSON.parse(position) : null;
    if (last && typeof last === "object") {
      const { translation, book, chapter, title } = last as Record<string, unknown>;
      if (typeof translation === "string" && typeof book === "string" && typeof chapter === "number")
        store = upsert(store, "history", {
          type: "chapter",
          key: `${translation}/${book.toUpperCase()}/${chapter}`,
          title: typeof title === "string" ? title : `${book} ${chapter}`,
          at,
        });
    }
    write(parseStore(JSON.stringify(store)));
    window.localStorage.removeItem(LEGACY_FAVORITES);
    window.localStorage.removeItem(LEGACY_POSITION);
  } catch {
    // keep the old data where it is
  }
}

/** Matches the device with the signed-in account (or forgets the account's data after sign-out). */
async function syncWith(db: BrowserClient | null, sync: Sync, userId: string | null) {
  if (!db || !userId) {
    if (read().owner) write(emptyStore());
    setAccount({ userId: null, status: "local" });
    return;
  }
  setAccount({ userId, status: "syncing" });
  const local = read();
  const mine = local.owner && local.owner !== userId ? emptyStore() : local;
  try {
    const { store, push } = merge(mine, await sync.fetchRemote(db), userId);
    write(store);
    await Promise.all(
      (Object.keys(push) as Collection[]).map((c) => sync.pushItems(db, userId, c, push[c] as Store[typeof c])),
    );
    setAccount({ status: "synced" });
  } catch {
    setAccount({ status: "error" });
  }
}

let started = false;

/** Starts once per page load: legacy migration, then account sync on every sign-in change. */
export function startPersonalSync(): () => void {
  if (started) return () => {};
  started = true;
  migrateLegacy();
  if (!hasSessionCookie()) {
    // Signed out: an account's library does not stay on the device.
    if (read().owner) write(emptyStore());
    return () => {
      started = false;
    };
  }
  let unsubscribe = () => {};
  let current: string | null | undefined;
  void loadAccountCode().then(({ db, sync }) => {
    if (!db) return;
    const run = (userId: string | null) => {
      if (userId === current) return;
      current = userId;
      void syncWith(db, sync, userId);
    };
    void db.auth.getSession().then(({ data }) => run(data.session?.user.id ?? null));
    const { data } = db.auth.onAuthStateChange((_event, session) => run(session?.user.id ?? null));
    unsubscribe = () => data.subscription.unsubscribe();
  });
  return () => {
    started = false;
    unsubscribe();
  };
}
