-- Phase 12: site-wide search.
--   * normalised search text (Tamil + English) on reflections, celebrations and Rosary mysteries
--   * search_content(): prayers, saints, Rosary mysteries, reflections and celebrations in one call;
--     every word must match (AND), titles rank above body text; row level security applies
--   * days_with_passage(): upcoming days whose Mass readings include a Bible passage

alter table public.reflections add column search_norm text generated always as (
  public.normalize_search_text(title || ' ' || body || ' ' || author)
) stored;
create index reflections_search_trgm_idx on public.reflections using gin (search_norm extensions.gin_trgm_ops);

alter table public.celebrations add column search_norm text generated always as (
  public.normalize_search_text(name_ta || ' ' || name_en)
) stored;
create index celebrations_search_trgm_idx on public.celebrations using gin (search_norm extensions.gin_trgm_ops);

alter table public.rosary_mysteries add column search_norm text generated always as (
  public.normalize_search_text(
    title_ta || ' ' || title_en || ' ' || coalesce(fruit_ta, '') || ' ' || coalesce(fruit_en, '') || ' ' ||
    coalesce(scripture_reference, '') || ' ' || coalesce(meditation_ta, '') || ' ' || coalesce(meditation_en, '')
  )
) stored;
create index rosary_mysteries_search_trgm_idx on public.rosary_mysteries using gin (search_norm extensions.gin_trgm_ops);

-- Words of a query (at least 2 characters, at most 8 words), LIKE wildcards escaped.
create function private.search_words(p_query text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_')), '{}')
  from (
    select w from unnest(string_to_array(public.normalize_search_text(p_query), ' ')) as w
    where char_length(w) >= 2 limit 8
  ) words;
$$;

-- True when every word occurs in the text.
create function private.matches_all(p_text text, p_words text[])
returns boolean
language sql
immutable
as $$
  select cardinality(p_words) > 0
     and not exists (select 1 from unnest(p_words) w where coalesce(p_text, '') not like '%' || w || '%');
$$;

create function public.search_content(
  p_query text,
  p_from date default current_date,
  p_calendar text default 'in',
  p_limit integer default 8
)
returns table (
  kind text,          -- prayer | saint | mystery | reflection | celebration
  key text,           -- slug, "<set>/<number>", reflection date, or celebration code
  title_en text,
  title_ta text,
  body text,          -- text to cut a snippet from (null for celebrations)
  language text,      -- reflections only
  next_date date,     -- celebrations: the next day it is kept
  title_match boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select private.search_words(p_query) as words, least(greatest(p_limit, 1), 20) as n)
  (select 'prayer', p.slug, p.title_en, p.title_ta, coalesce(p.body_ta, '') || E'\n\n' || coalesce(p.body_en, ''), null::text, null::date,
          private.matches_all(public.normalize_search_text(coalesce(p.title_ta, '') || ' ' || coalesce(p.title_en, '')), q.words)
   from public.prayers p, q
   where private.matches_all(p.search_norm, q.words)
   order by 8 desc, p.sort_order, p.slug limit (select n from q))
  union all
  (select 'saint', s.slug, s.name_en, s.name_ta, coalesce(s.biography_ta, s.biography_en), null, null,
          private.matches_all(public.normalize_search_text(s.name_ta || ' ' || s.name_en), q.words)
   from public.saints s, q
   where private.matches_all(s.search_norm || ' ' || public.normalize_search_text(coalesce(s.biography_en, '') || ' ' || coalesce(s.biography_ta, '')), q.words)
   order by 8 desc, s.feast_month, s.feast_day limit (select n from q))
  union all
  (select 'mystery', ms.key || '/' || m.number, m.title_en, m.title_ta, coalesce(m.meditation_ta, m.meditation_en), null, null,
          private.matches_all(public.normalize_search_text(m.title_ta || ' ' || m.title_en), q.words)
   from public.rosary_mysteries m join public.rosary_mystery_sets ms on ms.id = m.set_id, q
   where private.matches_all(m.search_norm, q.words)
   order by 8 desc, ms.sort_order, m.number limit (select n from q))
  union all
  (select 'reflection', r.reflection_date::text, r.title, r.title, r.body, r.language, r.reflection_date,
          private.matches_all(public.normalize_search_text(r.title), q.words)
   from public.reflections r, q
   where private.matches_all(r.search_norm, q.words)
   order by 8 desc, r.reflection_date desc limit (select n from q))
  union all
  (select 'celebration', c.code, c.name_en, c.name_ta, null, null, c.next_date, true
   from (
     -- Only celebrations the calendar keeps, with the next day each falls on.
     select c.code, c.name_en, c.name_ta,
            (select min(d.date) from public.liturgical_day_celebrations dc
               join public.liturgical_days d on d.id = dc.day_id
               join public.liturgical_calendars lc on lc.id = d.calendar_id
             where dc.celebration_id = c.id and lc.code = p_calendar and d.date >= p_from) as next_date
     from public.celebrations c, q
     where c.rank <> 'weekday' and private.matches_all(c.search_norm, q.words)
   ) c
   where c.next_date is not null
   order by c.next_date limit (select n from q));
$$;
grant execute on function public.search_content(text, date, text, integer) to anon, authenticated;

-- Upcoming days whose readings include any verse of [p_start, p_end] (canonical verse keys).
create function public.days_with_passage(
  p_start integer,
  p_end integer,
  p_from date default current_date,
  p_calendar text default 'in',
  p_limit integer default 6
)
returns table (date date, title_en text, title_ta text, reading_type text, reference text)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (d.date) d.date, d.title_en, d.title_ta, r.reading_type, r.reference_display
  from public.lectionary_reading_ranges g
  join public.bible_books b on b.id = g.book_id
  join public.lectionary_readings r on r.id = g.reading_id
  join public.liturgical_day_masses m on m.lectionary_set_id = r.set_id
  join public.liturgical_days d on d.id = m.day_id
  join public.liturgical_calendars lc on lc.id = d.calendar_id
  where lc.code = p_calendar
    and d.date >= p_from
    and b.canon_order * 1000000 + g.start_chapter * 1000 + g.start_verse <= p_end
    and b.canon_order * 1000000 + g.end_chapter * 1000 + least(g.end_verse, 999) >= p_start
  order by d.date, r.reading_type = 'gospel' desc
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.days_with_passage(integer, integer, date, text, integer) to anon, authenticated;

-- References typed in search: every book's own abbreviations, plus the short forms common in English
-- lectionaries and missals (Jn 3:16, Mt 5, Is 9:1, Ps 23).
insert into public.bible_book_names (book_id, language, alias)
select id, 'en', abbr_en from public.bible_books
union
select id, 'ta', abbr_ta from public.bible_books
on conflict (language, alias_norm) do nothing;

insert into public.bible_book_names (book_id, language, alias)
select b.id, 'en', a.alias
from (values
  ('GEN', 'Gn'), ('EXO', 'Ex'), ('LEV', 'Lv'), ('NUM', 'Nm'), ('DEU', 'Dt'), ('JOS', 'Jos'), ('JDG', 'Jgs'),
  ('RUT', 'Ru'), ('1SA', '1 Sm'), ('2SA', '2 Sm'), ('1KI', '1 Kgs'), ('2KI', '2 Kgs'), ('1CH', '1 Chr'),
  ('2CH', '2 Chr'), ('NEH', 'Neh'), ('TOB', 'Tb'), ('JDT', 'Jdt'), ('EST', 'Est'), ('1MA', '1 Mc'), ('2MA', '2 Mc'),
  ('PSA', 'Pss'), ('PSA', 'Psalm'), ('PRO', 'Prv'), ('ECC', 'Eccl'), ('ECC', 'Qoh'), ('SNG', 'Sg'), ('WIS', 'Ws'),
  ('SIR', 'Sir'), ('ISA', 'Is'), ('JER', 'Jer'), ('LAM', 'Lam'), ('BAR', 'Bar'), ('EZK', 'Ez'), ('DAN', 'Dn'),
  ('HOS', 'Hos'), ('JOL', 'Jl'), ('AMO', 'Am'), ('OBA', 'Ob'), ('JON', 'Jon'), ('MIC', 'Mi'), ('NAM', 'Na'),
  ('HAB', 'Hb'), ('ZEP', 'Zep'), ('HAG', 'Hg'), ('ZEC', 'Zec'), ('MAL', 'Mal'), ('MAT', 'Mt'), ('MRK', 'Mk'),
  ('LUK', 'Lk'), ('JHN', 'Jn'), ('ACT', 'Acts'), ('ROM', 'Rom'), ('1CO', '1 Cor'), ('2CO', '2 Cor'), ('GAL', 'Gal'),
  ('EPH', 'Eph'), ('PHP', 'Phil'), ('COL', 'Col'), ('1TH', '1 Thes'), ('2TH', '2 Thes'), ('1TI', '1 Tm'),
  ('2TI', '2 Tm'), ('TIT', 'Ti'), ('PHM', 'Phlm'), ('HEB', 'Heb'), ('JAS', 'Jas'), ('1PE', '1 Pt'), ('2PE', '2 Pt'),
  ('1JN', '1 Jn'), ('2JN', '2 Jn'), ('3JN', '3 Jn'), ('JUD', 'Jude'), ('REV', 'Rv')
) as a (code, alias)
join public.bible_books b on b.code = a.code
on conflict (language, alias_norm) do nothing;
