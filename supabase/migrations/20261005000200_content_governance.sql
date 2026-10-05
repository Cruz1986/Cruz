-- Content governance: sources/licences, publish workflow, audit trail, import batches.
-- Every publishable row points at a content source; it can only be published (and is
-- only publicly visible) while that source is verified and has a known licence (PRD §9).

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  copyright_holder text,
  license_type text not null default 'unknown'
    check (license_type in ('public_domain', 'licensed', 'permission_granted', 'original', 'unknown')),
  permission_status text not null default 'pending'
    check (permission_status in ('verified', 'pending', 'restricted')),
  attribution_text text,
  ecclesiastical_approval text,
  license_url text,
  notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger content_sources_updated_at before update on public.content_sources
  for each row execute function private.set_updated_at();

create or replace function private.source_is_usable(p_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_sources s
    where s.id = p_source_id
      and s.permission_status = 'verified'
      and s.license_type <> 'unknown'
  );
$$;

-- Public credits page: only verified sources, only public columns.
create view public.credits as
  select id, name, copyright_holder, license_type, attribution_text, ecclesiastical_approval, license_url
  from public.content_sources
  where permission_status = 'verified' and license_type <> 'unknown';

grant select on public.credits to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit log (also serves as revision history: before/after of every change)
-- ---------------------------------------------------------------------------
create table public.content_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index content_audit_log_entity_idx on public.content_audit_log (entity_type, entity_id, created_at desc);
create index content_audit_log_created_at_idx on public.content_audit_log (created_at desc);

create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.content_audit_log (actor_id, entity_type, entity_id, action, before_json, after_json)
  values (
    auth.uid(),
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger content_sources_audit after insert or update or delete on public.content_sources
  for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Import batches (written by import scripts with the service role)
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bible', 'lectionary', 'calendar', 'prayers', 'rosary', 'saints', 'other')),
  source_id uuid references public.content_sources (id) on delete restrict,
  file_name text not null,
  checksum text,
  dry_run boolean not null default false,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'rolled_back')),
  row_count integer not null default 0 check (row_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  errors jsonb not null default '[]'::jsonb,
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index import_batches_started_at_idx on public.import_batches (started_at desc);

-- ---------------------------------------------------------------------------
-- Publish workflow guard for content tables
-- ---------------------------------------------------------------------------
create or replace function private.guard_content_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  if new.status = 'published' then
    if not private.source_is_usable(new.source_id) then
      raise exception 'Cannot publish %: content source is not verified or its licence is unknown', tg_table_name
        using errcode = 'check_violation';
    end if;
    if tg_op = 'INSERT' or old.status is distinct from 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'published' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

/*
  Applies the standard content-table setup:
    * RLS: public reads published rows from usable sources; staff read everything;
      editors write drafts / in_review; publishers publish and delete
    * updated_at, publish guard and audit triggers
  Expects columns: id, source_id, status, published_at, updated_by, updated_at.
*/
create or replace function private.setup_content_table(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
  n text := (select relname from pg_class where oid = tbl);
begin
  execute format('alter table %s enable row level security', t);

  execute format('create trigger %I before update on %s for each row execute function private.set_updated_at()', n || '_updated_at', t);
  execute format('create trigger %I before insert or update on %s for each row execute function private.guard_content_row()', n || '_guard', t);
  execute format('create trigger %I after insert or update or delete on %s for each row execute function private.audit_change()', n || '_audit', t);

  execute format($p$create policy "public read published" on %s for select to anon, authenticated
    using (status = 'published' and published_at <= now() and private.source_is_usable(source_id))$p$, t);
  execute format($p$create policy "staff read all" on %s for select to authenticated using (public.is_staff())$p$, t);
  execute format($p$create policy "staff insert" on %s for insert to authenticated
    with check (public.is_publisher() or (public.is_staff() and status in ('draft', 'in_review')))$p$, t);
  execute format($p$create policy "staff update" on %s for update to authenticated
    using (public.is_publisher() or (public.is_staff() and status <> 'published'))
    with check (public.is_publisher() or (public.is_staff() and status in ('draft', 'in_review')))$p$, t);
  execute format($p$create policy "publishers delete" on %s for delete to authenticated using (public.is_publisher())$p$, t);
end;
$$;

/*
  Reference/configuration tables (book lists, calendars, categories, rosary steps):
  readable by everyone, written by publishers. Audited when the table has an `id`.
*/
create or replace function private.setup_reference_table(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
  n text := (select relname from pg_class where oid = tbl);
begin
  execute format('alter table %s enable row level security', t);

  if exists (select 1 from pg_attribute where attrelid = tbl and attname = 'updated_at' and not attisdropped) then
    execute format('create trigger %I before update on %s for each row execute function private.set_updated_at()', n || '_updated_at', t);
  end if;
  if exists (select 1 from pg_attribute where attrelid = tbl and attname = 'id' and not attisdropped) then
    execute format('create trigger %I after insert or update or delete on %s for each row execute function private.audit_change()', n || '_audit', t);
  end if;

  execute format($p$create policy "public read" on %s for select to anon, authenticated using (true)$p$, t);
  execute format($p$create policy "publishers insert" on %s for insert to authenticated with check (public.is_publisher())$p$, t);
  execute format($p$create policy "publishers update" on %s for update to authenticated using (public.is_publisher()) with check (public.is_publisher())$p$, t);
  execute format($p$create policy "publishers delete" on %s for delete to authenticated using (public.is_publisher())$p$, t);
end;
$$;

-- RLS ----------------------------------------------------------------------
alter table public.content_sources enable row level security;
alter table public.content_audit_log enable row level security;
alter table public.import_batches enable row level security;

create policy "content_sources: staff read" on public.content_sources
  for select to authenticated using (public.is_staff());
create policy "content_sources: publishers insert" on public.content_sources
  for insert to authenticated with check (public.is_publisher());
create policy "content_sources: publishers update" on public.content_sources
  for update to authenticated using (public.is_publisher()) with check (public.is_publisher());
create policy "content_sources: super admins delete" on public.content_sources
  for delete to authenticated using (public.has_role('super_admin'));

-- Insert-only: rows are written by the audit trigger; nobody edits or deletes history.
create policy "audit: publishers read" on public.content_audit_log
  for select to authenticated using (public.is_publisher());
revoke insert, update, delete, truncate on public.content_audit_log from anon, authenticated;

create policy "import_batches: staff read" on public.import_batches
  for select to authenticated using (public.is_staff());

-- Internal functions are not part of the API. (Triggers and policies run them without EXECUTE.)
revoke execute on function private.set_updated_at() from public;
revoke execute on function private.handle_new_user() from public;
revoke execute on function private.audit_change() from public;
revoke execute on function private.guard_content_row() from public;
revoke execute on function private.setup_content_table(regclass) from public;
revoke execute on function private.setup_reference_table(regclass) from public;
