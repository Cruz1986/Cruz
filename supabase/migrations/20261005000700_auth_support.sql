-- Phase 3: auth support.
--   * profiles.email (kept in sync with auth.users) so super admins can find users without the service role
--   * user_roles.user_id also references profiles, so the API can embed roles in a profile query
--   * current_user_roles(): the signed-in user's effective roles (empty when disabled)
--   * the last active super admin cannot be removed

alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;
create index profiles_email_idx on public.profiles (lower(email));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.key = 'user'
  on conflict do nothing;

  return new;
end;
$$;

create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_user_email();

revoke execute on function private.sync_user_email() from public;

alter table public.user_roles
  add constraint user_roles_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

create or replace function public.current_user_roles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.key order by r.key), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid()
    and p.disabled_at is null;
$$;

create or replace function private.protect_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.roles r where r.id = old.role_id and r.key = 'super_admin')
     and not exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id
       join public.profiles p on p.id = ur.user_id
       where r.key = 'super_admin' and ur.user_id <> old.user_id and p.disabled_at is null
     )
     -- deleting the whole account (auth.users cascade) is still allowed
     and exists (select 1 from public.profiles p where p.id = old.user_id)
  then
    raise exception 'Cannot remove the last active super admin' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger user_roles_protect_last_super_admin before delete on public.user_roles
  for each row execute function private.protect_last_super_admin();

revoke execute on function private.protect_last_super_admin() from public;
