import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  chapterKey,
  emptyStore,
  has,
  merge,
  parseLocation,
  parseStore,
  remove,
  upsert,
  validKey,
  verseKey,
} from "@/lib/personal/store";

const t = (minute: number) => new Date(Date.UTC(2026, 9, 5, 10, minute)).toISOString();

describe("keys", () => {
  it("builds and parses verse and chapter locations", () => {
    expect(verseKey("en-drc", "jhn", 1, 14)).toBe("en-drc/JHN/1/14");
    expect(chapterKey("ta-tcb2012", "PSA", 23)).toBe("ta-tcb2012/PSA/23");
    expect(parseLocation("en-drc/JHN/1/14")).toEqual({ translation: "en-drc", book: "JHN", chapter: 1, verse: 14 });
    expect(parseLocation("en-drc/JHN/1")).toEqual({ translation: "en-drc", book: "JHN", chapter: 1, verse: null });
    expect(parseLocation("John 1:14")).toBeNull();
  });

  it("validates keys like the database", () => {
    expect(validKey("verse", "en-drc/1SA/3/10")).toBe(true);
    expect(validKey("verse", "en-drc/1SA/3")).toBe(false);
    expect(validKey("prayer", "hail-mary")).toBe(true);
    expect(validKey("saint", "Hail Mary")).toBe(false);
  });
});

describe("parseStore", () => {
  it("returns an empty store for missing or broken data", () => {
    expect(parseStore(null)).toEqual(emptyStore());
    expect(parseStore("{nope")).toEqual(emptyStore());
  });

  it("keeps the valid items of a partly broken store", () => {
    const raw = JSON.stringify({
      version: 1,
      owner: "u1",
      bookmarks: [
        { type: "prayer", key: "memorare", vkey: null, at: t(1) },
        { type: "prayer", key: "Bad Key", vkey: null, at: t(2) },
        { nonsense: true },
      ],
      favorites: "oops",
    });
    const store = parseStore(raw);
    expect(store.owner).toBe("u1");
    expect(store.bookmarks.map((b) => b.key)).toEqual(["memorare"]);
    expect(store.favorites).toEqual([]);
  });
});

describe("upsert and remove", () => {
  it("replaces an item by identity and keeps newest first", () => {
    let store = emptyStore();
    store = upsert(store, "highlights", { vkey: 43001014, color: "yellow", location: "en-drc/JHN/1/14", at: t(1) });
    store = upsert(store, "highlights", { vkey: 43003016, color: "green", location: "en-drc/JHN/3/16", at: t(2) });
    store = upsert(store, "highlights", { vkey: 43001014, color: "blue", location: "ta-tcb2012/JHN/1/14", at: t(3) });
    expect(store.highlights.map((h) => [h.vkey, h.color])).toEqual([
      [43001014, "blue"],
      [43003016, "green"],
    ]);
    store = remove(store, "highlights", store.highlights[0]);
    expect(has(store, "highlights", "43001014")).toBe(false);
  });

  it("caps history", () => {
    let store = emptyStore();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++)
      store = upsert(store, "history", {
        type: "prayer",
        key: `p${i}`,
        title: `P${i}`,
        at: new Date(i * 1000).toISOString(),
      });
    expect(store.history).toHaveLength(HISTORY_LIMIT);
    expect(store.history[0].key).toBe(`p${HISTORY_LIMIT + 4}`);
  });
});

describe("merge", () => {
  it("unites device and account items and lists what to upload", () => {
    const local = upsert(upsert(emptyStore(), "favorites", { type: "prayer", key: "memorare", at: t(5) }), "notes", {
      type: "saint",
      key: "thomas",
      vkey: null,
      body: "newer on this device",
      at: t(9),
    });
    const remote = {
      ...emptyStore("u1"),
      favorites: [{ type: "saint" as const, key: "agnes", at: t(1) }],
      notes: [{ type: "saint" as const, key: "thomas", vkey: null, body: "older", at: t(2) }],
    };
    const { store, push } = merge(local, remote, "u1");
    expect(store.owner).toBe("u1");
    expect(store.favorites.map((f) => f.key)).toEqual(["memorare", "agnes"]);
    expect(store.notes[0].body).toBe("newer on this device");
    expect(push.favorites.map((f) => f.key)).toEqual(["memorare"]);
    expect(push.notes).toHaveLength(1);
  });

  it("keeps the account's newer version and uploads nothing for it", () => {
    const local = upsert(emptyStore(), "notes", { type: "prayer", key: "memorare", vkey: null, body: "old", at: t(1) });
    const remote = {
      ...emptyStore("u1"),
      notes: [{ type: "prayer" as const, key: "memorare", vkey: null, body: "new", at: t(4) }],
    };
    const { store, push } = merge(local, remote, "u1");
    expect(store.notes[0].body).toBe("new");
    expect(push.notes).toEqual([]);
  });
});
