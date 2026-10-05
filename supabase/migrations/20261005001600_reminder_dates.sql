-- A reminder belongs to the date on which the reader's chosen time fell. Before this, a 23:55 reminder sent
-- at 00:05 was recorded under the new date, so that date's own 23:55 reminder was then skipped.
-- With the date right, the job can look back further (the app asks for 60 minutes): a late or skipped
-- scheduler run delays reminders instead of losing them, and each date is still sent once.
create or replace function public.due_reminders(p_now timestamptz default now(), p_window_minutes integer default 15)
returns table (
  user_id uuid,
  local_date date,
  local_time time,
  timezone text,
  language text,
  daily_reading boolean,
  saint_of_day boolean,
  prayer boolean,
  rosary boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, w.scheduled_date, w.local_now::time, p.timezone,
         coalesce(pr.preferred_language, 'ta'), p.daily_reading, p.saint_of_day, p.prayer, p.rosary
  from public.notification_preferences p
  left join public.profiles pr on pr.id = p.user_id
  cross join lateral (
    select l.local_now, l.since, (l.local_now - make_interval(secs => l.since))::date as scheduled_date
    from (
      select p_now at time zone p.timezone as local_now,
             -- seconds since the chosen time, across midnight: 23:55 is 10 minutes ago at 00:05
             (extract(epoch from ((p_now at time zone p.timezone)::time - p.preferred_time))::integer + 86400) % 86400
               as since
    ) l
  ) w
  where p.enabled
    and (p.daily_reading or p.saint_of_day or p.prayer or p.rosary)
    and w.since < p_window_minutes * 60
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.user_id)
    and not exists (
      select 1 from public.notification_deliveries d
      where d.user_id = p.user_id and d.local_date = w.scheduled_date
    );
$$;
revoke execute on function public.due_reminders(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz, integer) to service_role;
