-- Phase 10: personal features, synced from the reader's device.
--   * items are identified by stable keys rather than row ids, so the same item saved on two devices
--     (or before signing in) merges into one: a verse is "<translation>/<BOOK>/<chapter>/<verse>",
--     prayers and saints are their slugs, a day is its ISO date
--   * one highlight per canonical verse (shown in every translation), one note per item
--   * history keeps the latest 200 chapters, prayers and saints opened

create function private.valid_entity_key(entity_type text, entity_key text)
returns boolean
language sql
immutable
as $$
  select case entity_type
    when 'verse' then entity_key ~ '^[a-z0-9-]+/[A-Z0-9]+/[0-9]{1,3}/[0-9]{1,3}$'
    when 'chapter' then entity_key ~ '^[a-z0-9-]+/[A-Z0-9]+/[0-9]{1,3}$'
    when 'liturgical_day' then entity_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    else entity_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(entity_key) <= 80
  end
$$;

-- Bookmarks, favorites and notes: entity_id (uuid) → entity_key (text)
alter table public.bookmarks drop constraint bookmarks_user_id_entity_type_entity_id_key;
alter table public.bookmarks drop column entity_id;
alter table public.bookmarks
  add column entity_key text not null,
  add column canonical_vkey integer,
  add constraint bookmarks_entity_key_check check (private.valid_entity_key(entity_type, entity_key)),
  add constraint bookmarks_user_entity_key unique (user_id, entity_type, entity_key);

alter table public.favorites drop constraint favorites_user_id_entity_type_entity_id_key;
alter table public.favorites drop column entity_id;
alter table public.favorites
  add column entity_key text not null,
  add constraint favorites_entity_key_check check (private.valid_entity_key(entity_type, entity_key)),
  add constraint favorites_user_entity_key unique (user_id, entity_type, entity_key);

drop index public.notes_user_entity_idx;
alter table public.notes drop column entity_id;
alter table public.notes
  add column entity_key text not null,
  add column canonical_vkey integer,
  add constraint notes_entity_key_check check (private.valid_entity_key(entity_type, entity_key)),
  add constraint notes_user_entity_key unique (user_id, entity_type, entity_key);

-- Highlights: one per canonical verse; `location` is where it was made
alter table public.highlights drop constraint highlights_user_id_translation_id_canonical_vkey_key;
alter table public.highlights drop column translation_id;
alter table public.highlights
  add column location text not null,
  add constraint highlights_location_check check (private.valid_entity_key('verse', location)),
  add constraint highlights_user_vkey unique (user_id, canonical_vkey);

-- History of chapters, prayers and saints (replaces the per-translation reading position)
drop table public.reading_history;
create table public.history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('chapter', 'prayer', 'saint')),
  entity_key text not null check (private.valid_entity_key(entity_type, entity_key)),
  title text not null check (char_length(title) between 1 and 200),
  visited_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_key)
);
create index history_user_idx on public.history (user_id, visited_at desc);

alter table public.history enable row level security;
create policy "owner only" on public.history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function private.trim_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.history h
  where h.user_id = new.user_id
    and (h.entity_type, h.entity_key) not in (
      select entity_type, entity_key from public.history
      where user_id = new.user_id order by visited_at desc limit 200
    );
  return null;
end;
$$;

create trigger history_trim after insert on public.history
  for each row execute function private.trim_history();

grant select, insert, update, delete on public.history to authenticated;
