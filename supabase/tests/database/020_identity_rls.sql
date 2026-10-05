begin;
select plan(10);

select tests.create_user('reader@example.test') as reader \gset
select tests.create_user('other@example.test') as other \gset

select ok(exists (select 1 from public.profiles where id = :'reader'), 'signup creates a profile');
select ok(
  exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
          where ur.user_id = :'reader' and r.key = 'user'),
  'signup grants the user role'
);

select tests.authenticate_as(:'reader');

select is((select count(*)::int from public.profiles), 1, 'a reader sees only their own profile');
select lives_ok(
  $$update public.profiles set preferred_language = 'en', font_scale = 1.25 where id = auth.uid()$$,
  'a reader can update their own preferences'
);
select throws_ok(
  $$update public.profiles set disabled_at = now() where id = auth.uid()$$,
  '42501', null,
  'a reader cannot change their disabled state'
);
select is_empty(
  format($$update public.profiles set display_name = 'x' where id = %L returning id$$, :'other'),
  'a reader cannot update another profile'
);
select throws_ok(
  format($$insert into public.user_roles (user_id, role_id) select %L, id from public.roles where key = 'super_admin'$$, :'reader'),
  '42501', null,
  'a reader cannot grant themselves a role'
);
select ok(not public.is_staff(), 'a reader is not staff');

reset role;
update public.profiles set disabled_at = now() where id = :'reader';
insert into public.user_roles (user_id, role_id) select :'reader', id from public.roles where key = 'super_admin';
select tests.authenticate_as(:'reader');
select ok(not public.has_role('super_admin'), 'a disabled account loses its roles');

select tests.authenticate_anon();
select is((select count(*)::int from public.profiles), 0, 'anonymous visitors see no profiles');

select * from finish();
rollback;
