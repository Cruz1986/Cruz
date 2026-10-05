begin;
select plan(7);

select tests.create_user('leaving@example.test') as leaving \gset
select tests.create_user('admin@example.test') as admin \gset
insert into public.notes (user_id, entity_type, entity_key, body) values (:'leaving', 'saint', 'thomas', 'my note');
insert into public.notification_preferences (user_id, enabled, daily_reading, preferred_time, timezone)
  values (:'leaving', true, true, '06:00', 'Asia/Kolkata');
insert into public.user_roles (user_id, role_id) select :'admin', id from public.roles where key = 'super_admin';

select tests.authenticate_as(:'leaving');
select lives_ok($$select public.delete_my_account()$$, 'a reader can delete their account');
reset role;
select is((select count(*)::int from auth.users where id = :'leaving'), 0, 'the account is gone');
select is((select count(*)::int from public.notes where user_id = :'leaving'), 0, 'with their notes');
select is((select count(*)::int from public.notification_preferences where user_id = :'leaving'), 0,
  'and their reminder settings');

select tests.authenticate_as(:'admin');
select throws_ok($$select public.delete_my_account()$$, 'P0001', 'last super admin',
  'the last super admin cannot delete their account');
reset role;

set local role anon;
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'visitors cannot call it');
reset role;
select is((select count(*)::int from auth.users where id = :'admin'), 1, 'the admin is still there');

select * from finish();
rollback;
