-- Phase 5: generated liturgical days and lectionary details.
--   * liturgical_days keep the day code, titles, precedence and kind produced by the calendar engine
--   * precedence uses the decimal ranks of the Table of Liturgical Days (e.g. 10.2)
--   * lectionary readings keep their source type code; "proper" readings replace the weekday's
--   * a day can have several Masses (vigil, night, dawn, day, chrism) and memorial reading sets

alter table public.celebrations
  alter column precedence type numeric(3, 1),
  add column type_code text;
alter table public.celebrations drop constraint celebrations_precedence_check;
alter table public.celebrations add constraint celebrations_precedence_check check (precedence between 1 and 13);

alter table public.liturgical_days
  add column day_code text not null,
  add column ferial_code text,
  add column title_en text not null,
  add column title_ta text not null,
  add column precedence numeric(3, 1) not null check (precedence between 1 and 13),
  add column kind text not null
    check (kind in ('solemnity', 'feast', 'memorial', 'optional_memorial', 'commemoration', 'weekday', 'sunday'));

alter table public.lectionary_readings
  add column source_type text not null,
  add column is_proper boolean not null default false;
alter table public.lectionary_readings drop constraint lectionary_readings_set_id_reading_type_sequence_alt_group__key;
alter table public.lectionary_readings add constraint lectionary_readings_set_source_type_key unique (set_id, source_type);
alter table public.lectionary_readings drop constraint lectionary_readings_reading_type_check;
alter table public.lectionary_readings add constraint lectionary_readings_reading_type_check
  check (reading_type in ('first', 'psalm', 'second', 'sequence', 'acclamation', 'gospel', 'procession_gospel', 'commons'));

alter table public.liturgical_day_masses drop constraint liturgical_day_masses_day_id_lectionary_set_id_key;
alter table public.liturgical_day_masses
  add column mass_key text not null default 'day' check (mass_key in ('vigil', 'night', 'dawn', 'day', 'chrism')),
  add column role text not null default 'base' check (role in ('base', 'memorial'));
alter table public.liturgical_day_masses
  add constraint liturgical_day_masses_unique unique (day_id, mass_key, lectionary_set_id);

create index lectionary_readings_set_idx on public.lectionary_readings (set_id);
create index lectionary_reading_ranges_reading_idx on public.lectionary_reading_ranges (reading_id);
