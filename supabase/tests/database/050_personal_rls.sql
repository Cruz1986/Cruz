begin;
select plan(9);

select tests.create_user('a@example.test') as user_a \gset
select tests.create_user('b@example.test') as user_b \gset

select tests.authenticate_as(:'user_a');
select lives_ok(
  $$insert into public.bookmarks (entity_type, entity_key) values ('prayer', 'hail-mary')$$,
  'a user can bookmark (user_id defaults to themselves)'
);
select lives_ok(
  $$insert into public.notes (entity_type, entity_key, body) values ('prayer', 'hail-mary', 'private thought')$$,
  'a user can write a note'
);
select lives_ok(
  $$insert into public.notification_preferences (enabled) values (true)$$,
  'a user can save notification preferences'
);

select tests.authenticate_as(:'user_b');
select is((select count(*)::int from public.bookmarks), 0, 'another user cannot see the bookmark');
select is((select count(*)::int from public.notes), 0, 'another user cannot read the note');
select is_empty($$update public.notes set body = 'hacked' returning id$$, 'another user cannot edit the note');
select is_empty($$delete from public.bookmarks returning id$$, 'another user cannot delete the bookmark');
select throws_ok(
  format($$insert into public.notes (user_id, entity_type, entity_key, body) values (%L, 'prayer', 'memorare', 'x')$$, :'user_a'),
  '42501', null,
  'a user cannot write rows owned by someone else'
);

select tests.authenticate_anon();
select is((select count(*)::int from public.notes), 0, 'anonymous visitors see no personal data');

select * from finish();
rollback;
