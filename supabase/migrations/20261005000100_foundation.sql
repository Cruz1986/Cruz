-- Foundation: extensions, shared helpers, identity and roles.
-- Conventions: uuid PKs, timestamptz, text + CHECK instead of enums, RLS on every table.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- Internal helpers live outside the API-exposed `public` schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search normalisation (Tamil + English)
--   * Unicode NFC so composed/decomposed Tamil vowel signs compare equal
--   * drop zero-width joiners/non-joiners and soft hyphens
--   * drop formatting markers used by imported Bible text (see CONTENT_RIGHTS.md)
--   * lower-case Latin text, collapse whitespace
-- ---------------------------------------------------------------------------
create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(
          regexp_replace(
            normalize(coalesce(input, ''), NFC),
            '[​-‍­⁠﻿❮❯⁽⁾₍₎␢⦃⦄]',
            '',
            'g'
          )
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  preferred_language text not null default 'ta' check (preferred_language in ('ta', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  font_scale numeric(4, 3) not null default 1 check (font_scale between 0.875 and 1.5),
  timezone text not null default 'Asia/Kolkata',
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Roles (RBAC): super_admin, content_admin, editor, user
-- ---------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('super_admin', 'content_admin', 'editor', 'user')),
  description text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_role_id_idx on public.user_roles (role_id);

-- SECURITY DEFINER so RLS policies can call it without recursing into user_roles' own policies.
create or replace function public.has_role(variadic role_keys text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and p.disabled_at is null
      and r.key = any (role_keys)
  );
$$;

-- Staff may create and edit drafts.
create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_role('super_admin', 'content_admin', 'editor');
$$;

-- Publishers may publish, unpublish and delete content.
create or replace function public.is_publisher()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_role('super_admin', 'content_admin');
$$;

revoke execute on function public.has_role(text[]) from public;
grant execute on function public.has_role(text[]) to anon, authenticated, service_role;

-- New sign-ups get a profile and the plain `user` role.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.key = 'user'
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- RLS ----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: super admins read all" on public.profiles
  for select to authenticated using (public.has_role('super_admin'));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Users may change their own preferences but not their disabled state.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, preferred_language, theme, font_scale, timezone) on public.profiles to authenticated;
-- Super admins disable accounts through a server action using the service role.

create policy "roles: authenticated read" on public.roles
  for select to authenticated using (true);

create policy "user_roles: read own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "user_roles: super admins read all" on public.user_roles
  for select to authenticated using (public.has_role('super_admin'));
create policy "user_roles: super admins grant" on public.user_roles
  for insert to authenticated with check (public.has_role('super_admin'));
create policy "user_roles: super admins revoke" on public.user_roles
  for delete to authenticated using (public.has_role('super_admin'));
