-- Phase 11: admin CMS.
--   * edits made in the admin survive re-imports and calendar regeneration:
--     celebrations.names_locked keeps edited names; lectionary_readings.is_edited keeps edited references
--   * a public storage bucket "media" for images (where Supabase Storage is available)
--   * one published reflection per date and language

alter table public.celebrations add column names_locked boolean not null default false;
alter table public.lectionary_readings add column is_edited boolean not null default false;

create unique index reflections_published_unique on public.reflections (reflection_date, language)
  where status = 'published';
create index reflections_status_idx on public.reflections (status, reflection_date desc);
create index content_audit_log_actor_idx on public.content_audit_log (actor_id, created_at desc);

-- Staff (not only publishers) may read the audit trail of what they work on.
drop policy "audit: publishers read" on public.content_audit_log;
create policy "audit: staff read" on public.content_audit_log
  for select to authenticated using (public.is_staff());

-- Who changed what: staff see each other's display name (or the name part of the e-mail address).
create or replace function public.staff_names(p_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, coalesce(p.display_name, split_part(u.email, '@', 1))
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_staff() and u.id = any (p_ids);
$$;
revoke execute on function public.staff_names(uuid[]) from public, anon;
grant execute on function public.staff_names(uuid[]) to authenticated;

-- Storage bucket for images (Supabase only; skipped on plain Postgres).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'storage' and c.relname = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('media', 'media', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    on conflict (id) do nothing;

    execute $p$create policy "media: staff upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and public.is_staff())$p$;
    execute $p$create policy "media: staff update" on storage.objects for update to authenticated
      using (bucket_id = 'media' and public.is_staff())$p$;
    execute $p$create policy "media: publishers delete" on storage.objects for delete to authenticated
      using (bucket_id = 'media' and public.is_publisher())$p$;
  end if;
end;
$$;

-- Corrects one reading's reference and its verse ranges in a single transaction (publishers).
-- p_ranges: [{"book": "ISA", "start_chapter": 58, "start_verse": 7, "start_part": "", "end_chapter": 58, ...}, …]
create function public.admin_set_reading_reference(p_reading_id uuid, p_reference text, p_ranges jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_publisher() then
    raise exception 'Only content admins can change readings' using errcode = 'insufficient_privilege';
  end if;
  update public.lectionary_readings set reference_display = p_reference, is_edited = true where id = p_reading_id;
  if not found then
    raise exception 'Reading not found' using errcode = 'no_data_found';
  end if;
  delete from public.lectionary_reading_ranges where reading_id = p_reading_id;
  insert into public.lectionary_reading_ranges
    (reading_id, seq, book_id, start_chapter, start_verse, start_part, end_chapter, end_verse, end_part)
  select p_reading_id, r.ord, b.id,
         (r.value ->> 'start_chapter')::smallint, (r.value ->> 'start_verse')::smallint, coalesce(r.value ->> 'start_part', ''),
         (r.value ->> 'end_chapter')::smallint, (r.value ->> 'end_verse')::smallint, coalesce(r.value ->> 'end_part', '')
  from jsonb_array_elements(p_ranges) with ordinality as r (value, ord)
  join public.bible_books b on b.code = r.value ->> 'book';
end;
$$;
revoke execute on function public.admin_set_reading_reference(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_set_reading_reference(uuid, text, jsonb) to authenticated;
