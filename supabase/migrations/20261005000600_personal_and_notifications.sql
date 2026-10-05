-- Personal data (bookmarks, favorites, highlights, notes, reading history) and notifications.
-- Every personal row is owned by exactly one user; RLS restricts all access to the owner.

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('verse', 'prayer', 'saint', 'reflection', 'rosary_mystery', 'liturgical_day')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('prayer', 'saint', 'rosary_mystery')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

-- Keyed by canonical verse so a highlight survives switching translation.
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  translation_id uuid not null references public.bible_translations (id) on delete cascade,
  canonical_vkey integer not null,
  color text not null check (color in ('yellow', 'green', 'blue', 'pink', 'purple')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, translation_id, canonical_vkey)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('verse', 'prayer', 'saint', 'reflection', 'rosary_mystery', 'liturgical_day')),
  entity_id uuid not null,
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Last position per translation.
create table public.reading_history (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  translation_id uuid not null references public.bible_translations (id) on delete cascade,
  book_id uuid not null references public.bible_books (id) on delete cascade,
  chapter smallint not null,
  verse smallint not null default 1,
  last_read_at timestamptz not null default now(),
  primary key (user_id, translation_id)
);

create index bookmarks_user_idx on public.bookmarks (user_id, created_at desc);
create index favorites_user_idx on public.favorites (user_id, created_at desc);
create index highlights_user_idx on public.highlights (user_id, created_at desc);
create index notes_user_entity_idx on public.notes (user_id, entity_type, entity_id);
create index reading_history_user_idx on public.reading_history (user_id, last_read_at desc);

create trigger highlights_updated_at before update on public.highlights
  for each row execute function private.set_updated_at();
create trigger notes_updated_at before update on public.notes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications (delivery provider is abstracted in application code)
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  daily_reading boolean not null default true,
  saint_of_day boolean not null default false,
  prayer boolean not null default false,
  rosary boolean not null default false,
  preferred_time time not null default '06:00',
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  keys jsonb not null check (keys ? 'p256dh' and keys ? 'auth'),
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily_reading', 'saint_of_day', 'prayer', 'rosary', 'announcement')),
  title_en text not null,
  title_ta text not null,
  body_en text,
  body_ta text,
  url text check (url is null or url ~ '^/'),                             -- in-app path only
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  provider_ref text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_due_idx on public.notifications (scheduled_at) where status = 'scheduled';

create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();
create trigger notifications_updated_at before update on public.notifications
  for each row execute function private.set_updated_at();

-- RLS ----------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['bookmarks', 'favorites', 'highlights', 'notes', 'reading_history',
                           'notification_preferences', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "owner only" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end;
$$;

alter table public.notifications enable row level security;
create policy "notifications: publishers manage" on public.notifications
  for all to authenticated using (public.is_publisher()) with check (public.is_publisher());
