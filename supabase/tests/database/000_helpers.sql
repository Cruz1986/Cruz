-- Test helpers (installed once per test database, outside the per-file transactions).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Creates an auth user (the signup trigger adds profile + `user` role) plus extra roles.
create or replace function tests.create_user(p_email text, p_roles text[] default '{}')
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into auth.users (email) values (p_email) returning id into v_id;
  insert into public.user_roles (user_id, role_id)
  select v_id, r.id from public.roles r where r.key = any (p_roles);
  return v_id;
end;
$$;

-- Switch the session to act as a signed-in user (transaction-local).
create or replace function tests.authenticate_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.authenticate_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select pass('test helpers installed');
select * from finish();
