-- Phase 14: performance.

-- Bible search with each word as its own LIKE condition on literal patterns, so the planner can combine the
-- trigram index for rare words (and scan in reading order for common ones). Words are LIKE-escaped and
-- quoted with format('%L'); there is no other dynamic SQL.
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
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  conditions text;
begin
  select string_agg(format('v.text_norm like %L', '%' || w || '%'), ' and ')
  into conditions
  from (
    select distinct replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') as w
    from unnest(string_to_array(public.normalize_search_text(p_query), ' ')) as w
    where char_length(w) >= 2
    limit 8
  ) words;
  if conditions is null then
    return;
  end if;

  return query execute format(
    $q$select b.code, v.chapter, v.verse, v.verse_label, v.text,
              (b.canon_order::bigint * 1000000000 + v.chapter * 1000000 + v.ordinal) as sort_key
       from public.bible_verses v
       join public.bible_translations t on t.id = v.translation_id
       join public.bible_books b on b.id = v.book_id
       where t.code = $1 and %s
         and (b.canon_order::bigint * 1000000000 + v.chapter * 1000000 + v.ordinal) > $2
       order by sort_key
       limit $3$q$,
    conditions
  ) using p_translation, p_after, least(greatest(p_limit, 1), 50);
end;
$$;
