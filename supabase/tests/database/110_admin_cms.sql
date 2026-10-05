begin;
select plan(11);

select tests.create_user('editor@example.test', array['editor']) as editor \gset
select tests.create_user('admin@example.test', array['content_admin']) as admin \gset
select tests.create_user('reader@example.test') as reader \gset

insert into public.content_sources (name, license_type, permission_status)
values ('CMS test', 'original', 'verified') returning id as source \gset
insert into public.bible_books (code, osis_id, canon_order, testament, chapter_count, name_en, name_ta, full_name_ta, abbr_en, abbr_ta)
select 'ZZT', 'Zzt', 99, 'old', 10, 'Test', 'சோதனை', 'சோதனை நூல்', 'Tst', 'சோ'
where not exists (select 1 from public.bible_books where code = 'ZZT');
insert into public.lectionary_sets (code) values ('TEST-SET') returning id as set_id \gset
insert into public.lectionary_readings (set_id, reading_type, source_type, reference_display)
values (:'set_id', 'first', 'R1', 'Tst 1:1') returning id as reading \gset

-- Reflections: one published per date and language
insert into public.reflections (reflection_date, language, title, body, author, source_id, status)
values ('2026-10-05', 'en', 'A', 'Body', 'Fr. A', :'source', 'published');
select throws_ok(
  format($$insert into public.reflections (reflection_date, language, title, body, author, source_id, status)
           values ('2026-10-05', 'en', 'B', 'Body', 'Fr. B', %L, 'published')$$, :'source'),
  '23505', null, 'only one reflection per date and language can be published'
);
select lives_ok(
  format($$insert into public.reflections (reflection_date, language, title, body, author, source_id, status)
           values ('2026-10-05', 'en', 'C', 'Body', 'Fr. C', %L, 'draft')$$, :'source'),
  'drafts for the same date are allowed'
);

-- Readings are corrected only by publishers, atomically
select tests.authenticate_as(:'editor');
select throws_ok(
  format($$select public.admin_set_reading_reference(%L, 'Tst 1:2', '[]'::jsonb)$$, :'reading'),
  '42501', null, 'editors cannot change readings'
);
select is((select count(*)::int from public.content_audit_log where entity_id = :'reading'::uuid) > 0, true,
  'staff can read the change history');
select is((select count(*)::int from public.staff_names(array[:'admin'::uuid])), 1, 'staff see each other''s names');

select tests.authenticate_as(:'admin');
select lives_ok(
  format($$select public.admin_set_reading_reference(%L, 'Tst 1:2-5', %L::jsonb)$$, :'reading',
    '[{"book": "ZZT", "start_chapter": 1, "start_verse": 2, "start_part": "", "end_chapter": 1, "end_verse": 5, "end_part": ""}]'),
  'publishers can correct a reading'
);
select is(
  (select reference_display || '|' || is_edited from public.lectionary_readings where id = :'reading'),
  'Tst 1:2-5|true', 'the reference is replaced and marked as edited'
);
select is(
  (select string_agg(start_verse || '-' || end_verse, ',') from public.lectionary_reading_ranges where reading_id = :'reading'),
  '2-5', 'its verse ranges are replaced'
);
select throws_ok(
  $$select public.admin_set_reading_reference(gen_random_uuid(), 'x', '[]'::jsonb)$$,
  'P0002', null, 'an unknown reading is reported'
);

select tests.authenticate_as(:'reader');
select is((select count(*)::int from public.content_audit_log), 0, 'readers cannot see the change history');
select is((select count(*)::int from public.staff_names(array[:'admin'::uuid])), 0, 'readers cannot look up staff names');

select * from finish();
rollback;
