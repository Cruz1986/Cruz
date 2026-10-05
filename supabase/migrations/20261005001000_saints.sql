-- Phase 9: saints.
--   * a saint's titles ("bishop and doctor") are kept apart from the name, as in the calendar
--   * search covers names, titles and patronage in both languages

alter table public.saints
  add column title_en text,
  add column title_ta text;

alter table public.saints drop column search_norm;
alter table public.saints add column search_norm text generated always as (public.normalize_search_text(
  name_ta || ' ' || name_en || ' ' || coalesce(title_ta, '') || ' ' || coalesce(title_en, '') || ' ' ||
  coalesce(patronage_ta, '') || ' ' || coalesce(patronage_en, '')
)) stored;
create index saints_search_trgm_idx on public.saints using gin (search_norm extensions.gin_trgm_ops);
