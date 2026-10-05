begin;
select plan(7);

insert into public.content_sources (name, license_type, permission_status)
values ('Saints test', 'original', 'verified') returning id as source \gset
insert into public.content_sources (name, license_type, permission_status)
values ('Saints unverified', 'unknown', 'pending') returning id as unverified \gset

insert into public.saints (slug, name_en, name_ta, title_en, title_ta, feast_month, feast_day, patronage_en, source_id, status)
values ('test-xavier', 'Saint Test Xavier', 'புனித சோதனை சவேரியார்', 'priest', 'மறைப்பணியாளர்', 12, 3, 'India', :'source', 'published')
returning id as published \gset
insert into public.saints (slug, name_en, name_ta, feast_month, feast_day, source_id)
values ('test-draft', 'Saint Draft', 'புனித வரைவு', 12, 3, :'source') returning id as draft \gset

select ok(
  (select search_norm like '%மறைப்பணியாளர்%' and search_norm like '%priest%' and search_norm like '%india%'
     from public.saints where id = :'published'),
  'search text includes titles and patronage in both languages'
);
select throws_ok(
  $$insert into public.saints (slug, name_en, name_ta, feast_month, feast_day, source_id) values ('bad', 'B', 'B', 2, 30, (select id from public.content_sources where name = 'Saints test'))$$,
  '22008', null, 'a feast date must exist'
);
select throws_ok(
  $$insert into public.saints (slug, name_en, name_ta, feast_month, source_id) values ('half', 'H', 'H', 2, (select id from public.content_sources where name = 'Saints test'))$$,
  '23514', null, 'feast month and day go together'
);
select throws_ok(
  format($$update public.saints set source_id = %L where id = %L$$, :'unverified', :'published'),
  '23514', null, 'a saint from an unverified source cannot stay published'
);

insert into public.celebrations (code, calendar_id, name_en, name_ta, rank, precedence, color, month, day, saint_id)
select 'test-celebration', id, 'Saint Test Xavier, priest', 'புனித சோதனை சவேரியார்', 'memorial', 10, 'white', 12, 3, :'published'
from public.liturgical_calendars where code = 'gr';

select tests.authenticate_anon();
select is((select count(*)::int from public.saints where slug like 'test-%'), 1, 'the public sees published saints only');
select is((select count(*)::int from public.celebrations where saint_id = :'published'), 1, 'celebrations show their saint');
select is_empty(
  $$update public.saints set name_en = 'x' where slug = 'test-xavier' returning 1$$,
  'the public cannot change saints'
);

select * from finish();
rollback;
