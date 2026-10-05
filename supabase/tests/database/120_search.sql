begin;
select plan(9);

insert into public.content_sources (name, license_type, permission_status)
values ('Search content test', 'original', 'verified') returning id as source \gset
insert into public.prayer_categories (slug, name_en, name_ta) values ('search-test', 'Test', 'சோதனை') returning id as cat \gset
insert into public.prayers (slug, category_id, title_en, body_en, source_id, status)
values ('search-public', :'cat', 'Prayer of Quietude', 'Grant us zebrafinch peace.', :'source', 'published'),
       ('search-draft', :'cat', 'Draft quietude', 'Zebrafinch draft.', :'source', 'draft');
insert into public.saints (slug, name_en, name_ta, biography_en, source_id, status)
values ('search-saint', 'Saint Quietude', 'புனித அமைதி', 'Known for zebrafinch silence.', :'source', 'published');
insert into public.reflections (reflection_date, language, title, body, author, source_id, status)
values ('2026-10-05', 'ta', 'அமைதியின் வழி', 'zebrafinch', 'Fr. T', :'source', 'published');

select tests.authenticate_anon();

select is((select count(*)::int from public.search_content('quietude') where kind = 'prayer'), 1,
  'published prayers are found, drafts are not');
select is((select title_match from public.search_content('quietude') where key = 'search-public'), true,
  'a title match is marked');
select is((select count(*)::int from public.search_content('zebrafinch')), 3,
  'body text, biographies and reflections are searched');
select is((select kind from public.search_content('அமைதியின்') limit 1), 'reflection', 'Tamil words are found');
select is((select count(*)::int from public.search_content('zebrafinch quietude')), 2, 'every word must match');
select is((select count(*)::int from public.search_content('%')), 0, 'LIKE wildcards are not interpreted');
select is((select count(*)::int from public.search_content('a')), 0, 'one-letter queries return nothing');
select lives_ok($$select * from public.days_with_passage(50003014, 50003021)$$, 'passages can be looked up');
select is((select count(*)::int from public.bible_book_names n join public.bible_books b on b.id = n.book_id
           where b.code = 'JHN' and n.alias = 'Jn'), 1, 'common short forms are book aliases');

select * from finish();
rollback;
