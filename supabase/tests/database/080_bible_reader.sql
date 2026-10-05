begin;
select plan(9);

insert into public.content_sources (name, license_type, permission_status)
values ('Search test', 'public_domain', 'verified') returning id as source \gset
insert into public.bible_translations (code, name, short_name, language, source_id, status)
values ('ta-test', 'Test', 'T', 'ta', :'source', 'published') returning id as tr \gset
insert into public.bible_translations (code, name, short_name, language, source_id)
values ('ta-draft', 'Draft', 'D', 'ta', :'source') returning id as draft \gset

insert into public.bible_verses (translation_id, book_id, chapter, verse, ordinal, text)
select :'tr', b.id, x.c, x.v, x.v, x.t
from public.bible_books b,
  (values (1, 1, 'தொடக்கத்தில் ஒளி இருந்தது'), (1, 2, 'இருள் அகன்றது; ஒளி வந்தது'), (1, 3, 'In the beginning 100% light_')) as x (c, v, t)
where b.code = 'GEN';
insert into public.bible_verses (translation_id, book_id, chapter, verse, ordinal, text)
select :'draft', id, 1, 1, 1, 'ஒளி மறைவு' from public.bible_books where code = 'GEN';
insert into public.bible_translation_books (translation_id, book_id, sort_order)
select tr, id, 1 from public.bible_books, (values (:'tr'::uuid), (:'draft'::uuid)) as x (tr) where code = 'GEN';

select tests.authenticate_anon();

select is((select count(*)::int from public.search_bible('ta-test', 'ஒளி')), 2, 'finds Tamil words');
select is((select count(*)::int from public.search_bible('ta-test', 'ஒளி வந்தது')), 1, 'all words must match');
select is((select count(*)::int from public.search_bible('ta-test', 'BEGINNING')), 1, 'English search is case-insensitive');
select is((select count(*)::int from public.search_bible('ta-test', '%')), 0, 'LIKE wildcards are not interpreted');
select is((select count(*)::int from public.search_bible('ta-test', 'x')), 0, 'one-letter queries return nothing');
select is(
  (select count(*)::int from public.search_bible('ta-test', 'ஒளி', 20, (select sort_key from public.search_bible('ta-test', 'ஒளி', 1)))),
  1,
  'keyset pagination continues after the last result'
);
select is((select count(*)::int from public.search_bible('ta-draft', 'ஒளி')), 0, 'draft translations are not searchable publicly');

select is(
  (select chapters from public.bible_book_chapters('ta-test') where book_code = 'GEN'),
  '{1}'::smallint[],
  'book chapters are listed per translation'
);
select is((select count(*)::int from public.bible_book_chapters('ta-draft')), 0, 'draft translations list no books publicly');

select * from finish();
rollback;
