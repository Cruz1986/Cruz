-- Readers can delete their own account. Their profile, roles, library, notes, reminder settings and devices go
-- with it (foreign keys cascade); content they edited as staff stays, without their name (set null).
-- The last active super admin cannot delete themselves: someone must be able to manage the site.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if exists (
       select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
       where ur.user_id = me and r.key = 'super_admin'
     )
     and not exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id
       join public.profiles p on p.id = ur.user_id
       where r.key = 'super_admin' and ur.user_id <> me and p.disabled_at is null
     ) then
    raise exception 'last super admin' using errcode = 'P0001', hint = 'last_super_admin';
  end if;
  delete from auth.users where id = me;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
