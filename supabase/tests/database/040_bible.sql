begin;
select plan(9);

insert into public.content_sources (name, license_type, permission_status)
values ('Test Bible', 'public_domain', 'verified') returning id as source \gset
insert into public.bible_translations (code, name, short_name, language, source_id)
values ('en-test', 'Test Bible', 'TB', 'en', :'source') returning id as tr \gset

insert into public.bible_verses (translation_id, book_id, chapter, verse, ordinal, text, canonical_vkey)
select :'tr', b.id, 1, v, v, 'Verse ' || v || ' text', public.vkey(b.canon_order, 1, v)
from public.bible_books b, generate_series(1, 3) v
where b.code = 'GEN';

select is(
  (select text_norm from public.bible_verses where translation_id = :'tr' and verse = 1),
  'verse 1 text',
  'verses get a normalised search column'
);
select ok(
  (select tsv @@ to_tsquery('simple', 'text') from public.bible_verses where translation_id = :'tr' and verse = 2),
  'verses are full-text searchable'
);
select throws_ok(
  format($$insert into public.bible_verses (translation_id, book_id, chapter, verse, ordinal, text)
           select %L, id, 1, 1, 99, 'dup' from public.bible_books where code = 'GEN'$$, :'tr'),
  '23505', null,
  'a verse cannot be stored twice'
);

select tests.authenticate_anon();
select is((select count(*)::int from public.bible_verses), 0, 'verses of a draft translation are hidden');
select is((select count(*)::int from public.bible_chapters), 0, 'chapter list follows verse visibility');

reset role;
update public.bible_translations set status = 'published' where id = :'tr';

select tests.authenticate_anon();
select is((select count(*)::int from public.bible_verses), 3, 'verses of a published translation are public');
select is(
  (select verse_count from public.bible_chapters where translation_id = :'tr' and chapter = 1),
  3,
  'chapter list counts verses'
);
select is((select count(*)::int from public.bible_books), 75, 'book list is public');
select throws_ok(
  format($$insert into public.bible_verses (translation_id, book_id, chapter, verse, ordinal, text)
           select %L, id, 2, 1, 1, 'x' from public.bible_books where code = 'GEN'$$, :'tr'),
  '42501', null,
  'anonymous visitors cannot write verses'
);

select * from finish();
rollback;
