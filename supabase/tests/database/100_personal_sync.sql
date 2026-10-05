begin;
select plan(11);

select tests.create_user('reader@example.test') as reader \gset
select tests.create_user('other@example.test') as other \gset
select tests.authenticate_as(:'reader');

select lives_ok(
  $$insert into public.bookmarks (entity_type, entity_key, canonical_vkey) values ('verse', 'en-drc/JHN/1/14', 43001014)$$,
  'a verse is bookmarked by its location'
);
select lives_ok(
  $$insert into public.bookmarks (entity_type, entity_key) values ('verse', 'en-drc/JHN/1/14')
    on conflict (user_id, entity_type, entity_key) do nothing$$,
  'saving the same bookmark again merges'
);
select is((select count(*)::int from public.bookmarks), 1, 'one bookmark per item');
select throws_ok(
  $$insert into public.bookmarks (entity_type, entity_key) values ('verse', 'John 1:14')$$,
  '23514', null, 'verse keys must be locations'
);
select throws_ok(
  $$insert into public.favorites (entity_type, entity_key) values ('saint', 'Not A Slug')$$,
  '23514', null, 'favorites use slugs'
);
select lives_ok(
  $$insert into public.highlights (canonical_vkey, color, location) values (43001014, 'yellow', 'en-drc/JHN/1/14')$$,
  'a verse can be highlighted'
);
select throws_ok(
  $$insert into public.highlights (canonical_vkey, color, location) values (43001014, 'blue', 'ta-tcb2012/JHN/1/14')$$,
  '23505', null, 'one highlight per canonical verse, whatever the translation'
);
select throws_ok(
  $$insert into public.notes (entity_type, entity_key, body) values ('saint', 'thomas', 'a'), ('saint', 'thomas', 'b')$$,
  '23505', null, 'one note per item'
);

insert into public.history (entity_type, entity_key, title, visited_at)
select 'chapter', 'en-drc/PSA/' || n, 'Psalm ' || n, now() - n * interval '1 minute'
from generate_series(1, 205) n;
select is((select count(*)::int from public.history), 200, 'history keeps the latest 200 items');
select ok(not exists (select 1 from public.history where entity_key = 'en-drc/PSA/205'), 'the oldest items are dropped');

select tests.authenticate_as(:'other');
select is((select count(*)::int from public.history) + (select count(*)::int from public.highlights), 0,
  'another reader sees none of it');

select * from finish();
rollback;
