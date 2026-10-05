-- Phase 13: reminders and announcements.
--   * one daily reminder per reader at their chosen local time, combining the parts they chose
--     (readings, saint of the day, Rosary, prayer); notification_deliveries makes sending idempotent
--   * announcements (public.notifications) are sent once when due, to readers with reminders enabled
--   * sending runs with the service role (scheduled job); readers manage only their own rows

-- A preference row must name a real time zone.
create function private.check_timezone()
returns trigger
language plpgsql
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception when others then
  raise exception 'Unknown time zone %', new.timezone using errcode = 'check_violation';
end;
$$;
create trigger notification_preferences_timezone before insert or update of timezone on public.notification_preferences
  for each row execute function private.check_timezone();

create table public.notification_deliveries (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,                -- the reader's date when the reminder was sent
  sent_at timestamptz not null default now(),
  devices smallint not null default 0,
  primary key (user_id, local_date)
);
alter table public.notification_deliveries enable row level security;
create policy "owner reads" on public.notification_deliveries for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.notifications
  add column sent_at timestamptz,
  add column recipients integer not null default 0;

-- Readers whose reminder is due in the window starting at p_now (and not yet sent for their local date).
create function public.due_reminders(p_now timestamptz default now(), p_window_minutes integer default 15)
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
  select p.user_id, (p_now at time zone p.timezone)::date, (p_now at time zone p.timezone)::time, p.timezone,
         coalesce(pr.preferred_language, 'ta'), p.daily_reading, p.saint_of_day, p.prayer, p.rosary
  from public.notification_preferences p
  left join public.profiles pr on pr.id = p.user_id
  where p.enabled
    and (p.daily_reading or p.saint_of_day or p.prayer or p.rosary)
    -- minutes since the chosen time, across midnight: 23:55 is due at 00:05
    and (extract(epoch from ((p_now at time zone p.timezone)::time - p.preferred_time))::integer + 86400) % 86400
        < p_window_minutes * 60
    and exists (select 1 from public.push_subscriptions s where s.user_id = p.user_id)
    and not exists (
      select 1 from public.notification_deliveries d
      where d.user_id = p.user_id and d.local_date = (p_now at time zone p.timezone)::date
    );
$$;
-- Only the scheduled job (service role) may list readers.
revoke execute on function public.due_reminders(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.due_reminders(timestamptz, integer) to service_role;
