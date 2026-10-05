/** Moves personal items between the browser store and the reader's account tables. */
import { z } from "zod";
import type { BrowserClient } from "@/lib/db/browser";
import { HIGHLIGHT_COLORS, type Collection, type Store } from "./store";

const TABLES = {
  bookmarks: "bookmarks",
  highlights: "highlights",
  notes: "notes",
  favorites: "favorites",
  history: "history",
} as const satisfies Record<Collection, string>;

const CONFLICT: Record<Collection, string> = {
  bookmarks: "user_id,entity_type,entity_key",
  highlights: "user_id,canonical_vkey",
  notes: "user_id,entity_type,entity_key",
  favorites: "user_id,entity_type,entity_key",
  history: "user_id,entity_type,entity_key",
};

const SELECT: Record<Collection, string> = {
  bookmarks: "entity_type, entity_key, canonical_vkey, created_at",
  highlights: "canonical_vkey, color, location, updated_at",
  notes: "entity_type, entity_key, canonical_vkey, body, updated_at",
  favorites: "entity_type, entity_key, created_at",
  history: "entity_type, entity_key, title, visited_at",
};

const iso = z.string().transform((v) => new Date(v).toISOString());
const ROW: { [C in Collection]: z.ZodType<Store[C][number]> } = {
  bookmarks: z
    .object({
      entity_type: z.enum(["verse", "prayer", "saint"]),
      entity_key: z.string(),
      canonical_vkey: z.number().nullable(),
      created_at: iso,
    })
    .transform((r) => ({ type: r.entity_type, key: r.entity_key, vkey: r.canonical_vkey, at: r.created_at })),
  highlights: z
    .object({ canonical_vkey: z.number(), color: z.enum(HIGHLIGHT_COLORS), location: z.string(), updated_at: iso })
    .transform((r) => ({ vkey: r.canonical_vkey, color: r.color, location: r.location, at: r.updated_at })),
  notes: z
    .object({
      entity_type: z.enum(["verse", "prayer", "saint"]),
      entity_key: z.string(),
      canonical_vkey: z.number().nullable(),
      body: z.string(),
      updated_at: iso,
    })
    .transform((r) => ({
      type: r.entity_type,
      key: r.entity_key,
      vkey: r.canonical_vkey,
      body: r.body,
      at: r.updated_at,
    })),
  favorites: z
    .object({ entity_type: z.enum(["prayer", "saint"]), entity_key: z.string(), created_at: iso })
    .transform((r) => ({ type: r.entity_type, key: r.entity_key, at: r.created_at })),
  history: z
    .object({
      entity_type: z.enum(["chapter", "prayer", "saint"]),
      entity_key: z.string(),
      title: z.string(),
      visited_at: iso,
    })
    .transform((r) => ({ type: r.entity_type, key: r.entity_key, title: r.title, at: r.visited_at })),
};

/** The database row for a store item. */
function toRow<C extends Collection>(collection: C, item: Store[C][number], userId: string): Record<string, unknown> {
  const i = item as Record<string, unknown>;
  switch (collection) {
    case "bookmarks":
      return { user_id: userId, entity_type: i.type, entity_key: i.key, canonical_vkey: i.vkey, created_at: i.at };
    case "highlights":
      return { user_id: userId, canonical_vkey: i.vkey, color: i.color, location: i.location, updated_at: i.at };
    case "notes":
      return {
        user_id: userId,
        entity_type: i.type,
        entity_key: i.key,
        canonical_vkey: i.vkey,
        body: i.body,
        updated_at: i.at,
      };
    case "favorites":
      return { user_id: userId, entity_type: i.type, entity_key: i.key, created_at: i.at };
    default:
      return { user_id: userId, entity_type: i.type, entity_key: i.key, title: i.title, visited_at: i.at };
  }
}

/** Everything the account holds. Throws on network or permission errors. */
export async function fetchRemote(db: BrowserClient): Promise<Omit<Store, "version" | "owner">> {
  const entries = await Promise.all(
    (Object.keys(TABLES) as Collection[]).map(async (collection) => {
      const { data, error } = await db.from(TABLES[collection]).select(SELECT[collection]).limit(5000);
      if (error) throw new Error(`${collection}: ${error.message}`);
      const rows = (data ?? []).flatMap((row: unknown) => {
        const parsed = ROW[collection].safeParse(row);
        return parsed.success ? [parsed.data] : [];
      });
      return [collection, rows] as const;
    }),
  );
  return Object.fromEntries(entries) as Omit<Store, "version" | "owner">;
}

export async function pushItems<C extends Collection>(
  db: BrowserClient,
  userId: string,
  collection: C,
  items: Store[C],
): Promise<void> {
  if (!items.length) return;
  const rows = (items as Store[C][number][]).map((item) => toRow(collection, item, userId));
  const { error } = await db.from(TABLES[collection]).upsert(rows, { onConflict: CONFLICT[collection] });
  if (error) throw new Error(`${collection}: ${error.message}`);
}

export async function deleteItem<C extends Collection>(
  db: BrowserClient,
  collection: C,
  item: Store[C][number],
): Promise<void> {
  const i = item as Record<string, unknown>;
  const query = db.from(TABLES[collection]).delete();
  const { error } =
    collection === "highlights"
      ? await query.eq("canonical_vkey", i.vkey as number)
      : await query.eq("entity_type", i.type as string).eq("entity_key", i.key as string);
  if (error) throw new Error(`${collection}: ${error.message}`);
}

export async function clearCollection(db: BrowserClient, collection: Collection): Promise<void> {
  // RLS limits the delete to the reader's own rows; PostgREST requires a filter.
  const column = collection === "highlights" ? "canonical_vkey" : "entity_key";
  const { error } = await db.from(TABLES[collection]).delete().not(column, "is", null);
  if (error) throw new Error(`${collection}: ${error.message}`);
}
