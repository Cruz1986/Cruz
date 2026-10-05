-- Bible: books, translations, verses, versification.
--
-- Verse identity has two layers:
--   * translation coordinates (book, chapter, verse, verse_part) as printed in that translation
--   * canonical_vkey: the same verse in the reference (Catholic canon order) versification,
--     used to align translations (parallel view), resolve lectionary ranges and keep
--     highlights stable across translations.
-- vkey = canon_order * 1 000 000 + chapter * 1 000 + verse  (e.g. Genesis 1:1 = 1001001)

create or replace function public.vkey(canon_order integer, chapter integer, verse integer)
returns integer
language sql
immutable
parallel safe
as $$
  select canon_order * 1000000 + chapter * 1000 + verse;
$$;

-- ---------------------------------------------------------------------------
-- Book master (73 Catholic canon books + Greek Esther / Daniel supplements that some
-- translations, e.g. the Tamil ecumenical Bible, print as separate books)
-- ---------------------------------------------------------------------------
create table public.bible_books (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[1-3]?[A-Z]{2,3}$'),          -- USFM book code
  osis_id text not null unique,
  canon_order smallint not null unique check (canon_order between 1 and 99),
  testament text not null check (testament in ('old', 'new')),
  is_deuterocanonical boolean not null default false,
  is_supplement boolean not null default false,                           -- ESG, DAG
  chapter_count smallint not null check (chapter_count > 0),
  name_en text not null,
  name_ta text not null,
  full_name_ta text not null,
  abbr_en text not null,
  abbr_ta text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every way a reader or an import file may refer to a book (for reference parsing).
create table public.bible_book_names (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.bible_books (id) on delete cascade,
  language text not null check (language in ('ta', 'en')),
  alias text not null,
  alias_norm text generated always as (public.normalize_search_text(alias)) stored,
  unique (language, alias_norm)
);

create index bible_book_names_book_id_idx on public.bible_book_names (book_id);

-- ---------------------------------------------------------------------------
-- Translations (publishable content; carry the licence via source_id)
-- ---------------------------------------------------------------------------
create table public.bible_translations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z]{2}-[a-z0-9-]+$'),        -- e.g. ta-tcb2012, en-dr
  name text not null,
  short_name text not null,
  language text not null check (language in ('ta', 'en')),
  versification text not null default 'canonical',
  description text,
  sort_order smallint not null default 0,
  source_id uuid not null references public.content_sources (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Book order and introductions as printed in a given translation.
create table public.bible_translation_books (
  translation_id uuid not null references public.bible_translations (id) on delete cascade,
  book_id uuid not null references public.bible_books (id) on delete restrict,
  sort_order smallint not null,
  intro text,
  primary key (translation_id, book_id),
  unique (translation_id, sort_order)
);

create table public.bible_verses (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.bible_translations (id) on delete cascade,
  book_id uuid not null references public.bible_books (id) on delete restrict,
  chapter smallint not null check (chapter between 1 and 999),
  verse smallint not null check (verse between 0 and 999),                -- 0 = superscription
  verse_part text not null default '' check (verse_part ~ '^[a-z]{0,2}$'),
  ordinal integer not null check (ordinal > 0),                           -- reading order within the chapter
  text text not null check (char_length(text) > 0),
  text_norm text generated always as (public.normalize_search_text(text)) stored,
  tsv tsvector generated always as (to_tsvector('simple'::regconfig, coalesce(public.normalize_search_text(text), ''))) stored,
  canonical_vkey integer,
  created_at timestamptz not null default now(),
  unique (translation_id, book_id, chapter, verse, verse_part),
  unique (translation_id, book_id, chapter, ordinal)
);

create index bible_verses_canonical_idx on public.bible_verses (translation_id, canonical_vkey);
create index bible_verses_tsv_idx on public.bible_verses using gin (tsv);
create index bible_verses_trgm_idx on public.bible_verses using gin (text_norm extensions.gin_trgm_ops);
create index bible_verses_book_id_idx on public.bible_verses (book_id);

create table public.bible_section_headings (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.bible_translations (id) on delete cascade,
  book_id uuid not null references public.bible_books (id) on delete restrict,
  chapter smallint not null check (chapter between 1 and 999),
  before_verse smallint not null check (before_verse between 0 and 999),
  level smallint not null default 1 check (level between 1 and 3),
  text text not null,
  sort_order smallint not null default 0
);

create index bible_section_headings_lookup_idx
  on public.bible_section_headings (translation_id, book_id, chapter, before_verse, sort_order);

-- Maps a versification scheme's coordinates to canonical vkeys (only where they differ).
create table public.versification_maps (
  scheme text not null,
  book_id uuid not null references public.bible_books (id) on delete cascade,
  chapter smallint not null,
  verse smallint not null,
  verse_part text not null default '',
  canonical_vkey integer not null,
  primary key (scheme, book_id, chapter, verse, verse_part)
);

-- Chapter list with verse counts; security_invoker so verse RLS applies.
create view public.bible_chapters with (security_invoker = true) as
  select translation_id, book_id, chapter, count(*)::integer as verse_count
  from public.bible_verses
  group by translation_id, book_id, chapter;

grant select on public.bible_chapters to anon, authenticated;

-- RLS ----------------------------------------------------------------------
select private.setup_reference_table('public.bible_books');
select private.setup_reference_table('public.bible_book_names');
select private.setup_reference_table('public.versification_maps');
select private.setup_content_table('public.bible_translations');

-- Translation children are visible exactly when their translation is (RLS on the
-- translation applies inside the sub-query), and written by publishers / imports.
do $$
declare
  t text;
begin
  foreach t in array array['bible_translation_books', 'bible_verses', 'bible_section_headings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "read with translation" on public.%I for select to anon, authenticated
      using (exists (select 1 from public.bible_translations tr where tr.id = translation_id))$p$, t);
    execute format($p$create policy "publishers write" on public.%I for all to authenticated
      using (public.is_publisher()) with check (public.is_publisher())$p$, t);
  end loop;
end;
$$;
