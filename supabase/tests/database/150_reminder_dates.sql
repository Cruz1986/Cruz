begin;
select plan(5);

select tests.create_user('night@example.test') as night \gset
insert into public.notification_preferences (user_id, enabled, daily_reading, preferred_time, timezone)
  values (:'night', true, true, '23:55', 'Asia/Kolkata');
insert into public.push_subscriptions (user_id, endpoint, keys)
  values (:'night', 'https://push.example/night', '{"p256dh": "x", "auth": "y"}');

-- 00:05 on 6 October in India (18:35 UTC on the 5th): the 23:55 reminder of 5 October, sent late.
select is((select local_date from public.due_reminders('2026-10-05 18:35+00', 15)), '2026-10-05'::date,
  'a reminder sent after midnight belongs to the date its time fell on');
insert into public.notification_deliveries (user_id, local_date) values (:'night', '2026-10-05');
select is((select count(*)::int from public.due_reminders('2026-10-05 18:40+00', 15)), 0, 'and is sent once');
-- 23:56 on 6 October in India = 18:26 UTC on the 6th
select is((select local_date from public.due_reminders('2026-10-06 18:26+00', 15)), '2026-10-06'::date,
  'the next day''s reminder still comes at its time');

-- A longer window survives a late scheduler: 06:00 reader, job runs at 06:50.
select tests.create_user('morning@example.test') as morning \gset
insert into public.notification_preferences (user_id, enabled, daily_reading, preferred_time, timezone)
  values (:'morning', true, true, '06:00', 'Asia/Kolkata');
insert into public.push_subscriptions (user_id, endpoint, keys)
  values (:'morning', 'https://push.example/morning', '{"p256dh": "x", "auth": "y"}');
-- 06:50 in India = 01:20 UTC
select is((select array_agg(user_id) from public.due_reminders('2026-10-07 01:20+00', 60)), array[:'morning'::uuid],
  'a reminder missed by a late run is sent by the next one within the window');
select is((select count(*)::int from public.due_reminders('2026-10-07 01:20+00', 15)), 0,
  'but not with a short window');

select * from finish();
rollback;
