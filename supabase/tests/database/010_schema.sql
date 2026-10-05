begin;
select plan(18);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'every public table has row level security enabled'
);

select is(
  (select array_agg(c.relname order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)),
  null,
  'every RLS table has at least one policy'
);

select is((select count(*)::int from public.roles), 4, 'four roles seeded');
select is((select count(*)::int from public.bible_books), 75, '75 book rows (73 canon + 2 supplements)');
select is((select count(*)::int from public.bible_books where not is_supplement), 73, '73 books in the Catholic canon');
select is((select count(*)::int from public.bible_books where is_deuterocanonical and not is_supplement), 7, '7 deuterocanonical books');
select is(
  (select array_agg(canon_order order by canon_order) from public.bible_books),
  (select array_agg(g::smallint) from generate_series(1, 75) g),
  'canon_order is contiguous 1..75'
);
select is(
  (select count(*)::int from public.bible_books b
   where (select count(*) from public.bible_book_names n where n.book_id = b.id and n.language = 'ta') < 1
      or (select count(*) from public.bible_book_names n where n.book_id = b.id and n.language = 'en') < 1),
  0,
  'every book has Tamil and English aliases'
);
select ok(
  (select bool_and(name_ta ~ '[஀-௿]') from public.bible_books),
  'Tamil book names are Unicode Tamil'
);

select is(
  (select array_agg(d order by d) from public.rosary_mystery_sets, unnest(weekdays) d),
  array[1, 2, 3, 4, 5, 6, 7]::smallint[],
  'each weekday maps to exactly one Rosary mystery set'
);
select is(
  (select settings ->> 'ascension_on_sunday' from public.liturgical_calendars where code = 'in'),
  'true',
  'India calendar transfers Ascension to Sunday'
);

select is(public.vkey(1, 1, 1), 1001001, 'vkey(Genesis 1:1)');
select is(public.vkey(23, 119, 176), 23119176, 'vkey(Psalm 119:176)');

select is(
  public.normalize_search_text(normalize('கொ', NFD)),
  public.normalize_search_text('கொ'),
  'search normalisation makes decomposed and composed Tamil equal'
);
select is(public.normalize_search_text(E'அன்‍பு'), 'அன்பு', 'zero-width joiners are removed');
select is(public.normalize_search_text('  In the   BEGINNING '), 'in the beginning', 'Latin text lower-cased, spaces collapsed');
select is(public.normalize_search_text('   '), null, 'blank text normalises to null');

set local role authenticated;
select throws_ok(
  $$select private.setup_reference_table('public.roles')$$,
  '42501', null,
  'internal setup functions are not callable by API roles'
);
reset role;

select * from finish();
rollback;
