begin;
select plan(7);

select tests.create_user('admin@example.test', '{super_admin}') as admin \gset
select tests.create_user('reader@example.test') as reader \gset

select is((select email from public.profiles where id = :'reader'), 'reader@example.test', 'profile stores the email');
update auth.users set email = 'renamed@example.test' where id = :'reader';
select is((select email from public.profiles where id = :'reader'), 'renamed@example.test', 'email changes are synced');

select tests.authenticate_as(:'reader');
select is(public.current_user_roles(), array['user'], 'current_user_roles returns the reader role');
select throws_ok(
  $$update public.profiles set email = 'evil@example.test' where id = auth.uid()$$,
  '42501', null,
  'users cannot change their stored email'
);

select tests.authenticate_as(:'admin');
select is(public.current_user_roles(), array['super_admin', 'user'], 'current_user_roles lists all roles');
select throws_ok(
  format($$delete from public.user_roles where user_id = %L
           and role_id = (select id from public.roles where key = 'super_admin')$$, :'admin'),
  '23514', null,
  'the last super admin cannot be removed'
);

reset role;
update public.profiles set disabled_at = now() where id = :'reader';
select tests.authenticate_as(:'reader');
select is(public.current_user_roles(), '{}'::text[], 'a disabled account has no roles');

select * from finish();
rollback;
