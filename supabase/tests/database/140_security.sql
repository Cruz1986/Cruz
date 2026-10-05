begin;
select plan(4);

-- Every table the API exposes is protected by row level security.
select is(
  (select coalesce(array_agg(c.relname order by c.relname), '{}')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '{}'::name[],
  'row level security is enabled on every public table'
);

-- Functions that run with their owner's rights cannot be tricked through the search path.
select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  '{}'::text[],
  'every security definer function sets its search_path'
);

-- Owner-rights functions callable by anonymous visitors are an explicit, short list.
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  array['current_user_roles', 'has_role'],
  'anonymous visitors can call only the role checks among owner-rights functions'
);

-- The scheduled job's reader list is not reachable with the public or reader keys.
select ok(
  not has_function_privilege('anon', 'public.due_reminders(timestamptz, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.due_reminders(timestamptz, integer)', 'execute'),
  'only the service role can list readers due a reminder'
);

select * from finish();
rollback;
