-- Phase 4: Bible reader support.
--   * layout flags on verses (poetry lines, paragraph ends, merged-verse labels such as "4-5")
--   * chapter 0 allowed for prologues (e.g. the translator's prologue to Sirach)
--   * search_bible(): word search over one translation, RLS applies (security invoker)

alter table public.bible_verses
  add column verse_label text check (verse_label ~ '^[0-9]+[a-z]?(-[0-9]+[a-z]?)?$'),
  add column is_poetry boolean not null default false,
  add column paragraph_end boolean not null default false;

alter table public.bible_verses drop constraint bible_verses_chapter_check;
alter table public.bible_verses add constraint bible_verses_chapter_check check (chapter between 0 and 999);
alter table public.bible_section_headings drop constraint bible_section_headings_chapter_check;
alter table public.bible_section_headings add constraint bible_section_headings_chapter_check check (chapter between 0 and 999);

comment on column public.bible_verses.text is
  'Reading text. Line breaks (\n) separate poetry lines; no other markup.';
comment on column public.bible_verses.verse_label is
  'Printed verse label when it differs from `verse`, e.g. "4-5" for merged verses.';

-- Position for stable ordering / keyset pagination: canon order, chapter, verse.
create index bible_verses_reading_order_idx
  on public.bible_verses (translation_id, book_id, chapter, ordinal);

create or replace function public.search_bible(
  p_translation text,
  p_query text,
  p_limit integer default 20,
  p_after bigint default 0
)
returns table (
  book_code text,
  chapter smallint,
  verse smallint,
  verse_label text,
  text text,
  sort_key bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    -- Each word must appear (AND). LIKE wildcards in the input are escaped.
    select distinct replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') as w
    from unnest(string_to_array(public.normalize_search_text(p_query), ' ')) as w
    where char_length(w) >= 2
    limit 8
  )
  select b.code, v.chapter, v.verse, v.verse_label, v.text,
         (b.canon_order::bigint * 1000000000 + v.chapter * 1000000 + v.ordinal) as sort_key
  from public.bible_verses v
  join public.bible_translations t on t.id = v.translation_id
  join public.bible_books b on b.id = v.book_id
  where t.code = p_translation
    and exists (select 1 from words)
    and not exists (select 1 from words where v.text_norm not like '%' || words.w || '%')
    and (b.canon_order::bigint * 1000000000 + v.chapter * 1000000 + v.ordinal) > p_after
  order by sort_key
  limit least(greatest(p_limit, 1), 50);
$$;

grant execute on function public.search_bible(text, text, integer, bigint) to anon, authenticated;

-- Book list with the chapters that exist in a translation (one row per book; RLS applies).
create or replace function public.bible_book_chapters(p_translation text)
returns table (book_code text, sort_order smallint, chapters smallint[])
language sql
stable
security invoker
set search_path = ''
as $$
  select b.code, tb.sort_order, array_agg(distinct v.chapter order by v.chapter)
  from public.bible_translations t
  join public.bible_translation_books tb on tb.translation_id = t.id
  join public.bible_books b on b.id = tb.book_id
  join public.bible_verses v on v.translation_id = t.id and v.book_id = b.id
  where t.code = p_translation
  group by b.code, tb.sort_order
  order by tb.sort_order;
$$;

grant execute on function public.bible_book_chapters(text) to anon, authenticated;
