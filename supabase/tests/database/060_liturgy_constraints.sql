begin;
select plan(7);

select id as cal from public.liturgical_calendars where code = 'gr' \gset
insert into public.celebrations (code, calendar_id, name_en, name_ta, rank, precedence, color, month, day)
values ('test-a', :'cal', 'A', 'அ', 'memorial', 10, 'white', 1, 2),
       ('test-b', :'cal', 'B', 'ஆ', 'optional_memorial', 12, 'white', 1, 2);
insert into public.liturgical_days
  (calendar_id, date, season, week_number, sunday_cycle, weekday_cycle, psalter_week, color, day_code, title_en, title_ta, precedence, kind)
values (:'cal', '2026-01-02', 'christmas', null, 'A', 'II', 1, 'white', 'CW02-Jan2', 'Jan 2', 'சனவரி 2', 12.3, 'weekday')
returning id as day \gset

select lives_ok(
  format($$insert into public.liturgical_day_celebrations (day_id, celebration_id, is_primary)
           select %L, id, true from public.celebrations where code = 'test-a'$$, :'day'),
  'a day has a primary celebration'
);
select throws_ok(
  format($$insert into public.liturgical_day_celebrations (day_id, celebration_id, is_primary)
           select %L, id, true from public.celebrations where code = 'test-b'$$, :'day'),
  '23505', null,
  'a day cannot have two primary celebrations'
);
select throws_ok(
  format($$insert into public.liturgical_days (calendar_id, date, season, sunday_cycle, weekday_cycle, color, day_code, title_en, title_ta, precedence, kind)
           values (%L, '2026-01-02', 'christmas', 'A', 'II', 'white', 'x', 'x', 'x', 12.3, 'weekday')$$, :'cal'),
  '23505', null,
  'one liturgical day per calendar and date'
);

insert into public.lectionary_sets (code) values ('test-set') returning id as set_id \gset
insert into public.lectionary_readings (set_id, reading_type, reference_display, source_type)
values (:'set_id', 'gospel', 'Jn 1:1-5', '6') returning id as reading \gset
select throws_ok(
  format($$insert into public.lectionary_reading_ranges (reading_id, seq, book_id, start_chapter, start_verse, end_chapter, end_verse)
           select %L, 1, id, 1, 5, 1, 1 from public.bible_books where code = 'JHN'$$, :'reading'),
  '23514', null,
  'a reading range cannot end before it starts'
);

insert into public.content_sources (name, license_type, permission_status) values ('S', 'original', 'verified') returning id as source \gset
select throws_ok(
  format($$insert into public.saints (slug, name_en, name_ta, feast_month, feast_day, source_id)
           values ('nobody', 'Nobody', 'யாருமில்லை', 2, 30, %L)$$, :'source'),
  '22008', null,
  'an impossible feast date is rejected'
);
select throws_ok(
  format($$insert into public.media (kind, storage_path, mime_type, bytes, source_id)
           values ('image', 'x.jpg', 'image/jpeg', 100, %L)$$, :'source'),
  '23514', null,
  'images require alt text'
);
select throws_ok(
  format($$insert into public.media (kind, storage_path, mime_type, bytes, alt_en, source_id)
           values ('image', 'x.svg', 'image/svg+xml', 100, 'x', %L)$$, :'source'),
  '23514', null,
  'SVG uploads are rejected'
);

select * from finish();
rollback;
