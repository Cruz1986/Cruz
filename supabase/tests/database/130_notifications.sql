begin;
select plan(11);

select tests.create_user('early@example.test') as early \gset
select tests.create_user('late@example.test') as late \gset
select tests.create_user('nodevice@example.test') as nodevice \gset

-- Prefs are written by readers themselves; set up directly here.
insert into public.notification_preferences (user_id, enabled, daily_reading, preferred_time, timezone) values
  (:'early', true, true, '06:00', 'Asia/Kolkata'),
  (:'late', true, true, '23:55', 'Asia/Kolkata'),
  (:'nodevice', true, true, '06:00', 'Asia/Kolkata');
insert into public.push_subscriptions (user_id, endpoint, keys) values
  (:'early', 'https://push.example/early', '{"p256dh": "x", "auth": "y"}'),
  (:'late', 'https://push.example/late', '{"p256dh": "x", "auth": "y"}');

-- 06:05 in India = 00:35 UTC
select is((select array_agg(user_id) from public.due_reminders('2026-10-05 00:35+00', 15)), array[:'early'::uuid],
  'a reader is due within the window after their time, if they have a device');
select is((select local_date from public.due_reminders('2026-10-05 00:35+00', 15)), '2026-10-05'::date, 'in their local date');
select is((select count(*)::int from public.due_reminders('2026-10-05 00:55+00', 15)), 0, 'not after the window');
select is((select count(*)::int from public.due_reminders('2026-10-05 00:25+00', 15)), 0, 'not before their time');
-- 00:05 the next day in India (23:55 + 10 minutes) = 18:35 UTC
select is((select array_agg(user_id) from public.due_reminders('2026-10-05 18:35+00', 15)), array[:'late'::uuid],
  'a late reminder is due across midnight');

insert into public.notification_deliveries (user_id, local_date) values (:'early', '2026-10-05');
select is((select count(*)::int from public.due_reminders('2026-10-05 00:35+00', 15)), 0, 'never twice on the same date');
select is((select count(*)::int from public.due_reminders('2026-10-06 00:35+00', 15)), 1, 'again the next day');

select throws_ok(
  format($$update public.notification_preferences set timezone = 'Mars/Olympus' where user_id = %L$$, :'early'),
  '23514', null, 'time zones are checked'
);

select tests.authenticate_as(:'early');
select throws_ok($$select * from public.due_reminders()$$, '42501', null, 'readers cannot list who gets reminders');
select is((select count(*)::int from public.notification_deliveries), 1, 'readers see their own deliveries');
select tests.authenticate_as(:'late');
select is((select count(*)::int from public.notification_deliveries), 0, 'and not other readers''');

select * from finish();
rollback;
