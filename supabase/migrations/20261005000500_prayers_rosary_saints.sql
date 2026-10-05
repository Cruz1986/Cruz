-- Media, prayers, Rosary and saints.

create table public.media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image', 'audio')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'audio/mpeg', 'audio/mp4')),
  bytes integer not null check (bytes > 0 and bytes <= 15 * 1024 * 1024),
  width integer check (width > 0),
  height integer check (height > 0),
  alt_en text,
  alt_ta text,
  attribution_text text,
  source_id uuid not null references public.content_sources (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'image' or (alt_en is not null or alt_ta is not null))  -- images need alt text
);

-- ---------------------------------------------------------------------------
-- Prayers
-- ---------------------------------------------------------------------------
create table public.prayer_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ta text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prayers (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.prayer_categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en text,
  title_ta text,
  body_en text,                                                           -- constrained Markdown
  body_ta text,
  sort_order smallint not null default 0,
  search_norm text generated always as (
    public.normalize_search_text(
      coalesce(title_ta, '') || ' ' || coalesce(title_en, '') || ' ' || coalesce(body_ta, '') || ' ' || coalesce(body_en, '')
    )
  ) stored,
  source_id uuid not null references public.content_sources (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- at least one complete language
  check ((title_en is not null and body_en is not null) or (title_ta is not null and body_ta is not null))
);

create index prayers_category_idx on public.prayers (category_id, sort_order);
create index prayers_search_trgm_idx on public.prayers using gin (search_norm extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Rosary
-- ---------------------------------------------------------------------------
create table public.rosary_mystery_sets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('joyful', 'sorrowful', 'glorious', 'luminous')),
  name_en text not null,
  name_ta text not null,
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),  -- ISO 1 = Monday
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rosary_mysteries (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.rosary_mystery_sets (id) on delete restrict,
  number smallint not null check (number between 1 and 5),
  title_en text not null,
  title_ta text not null,
  scripture_reference text,
  fruit_en text,
  fruit_ta text,
  meditation_en text,
  meditation_ta text,
  source_id uuid not null references public.content_sources (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, number)
);

-- The guided sequence is data: opening prayers, the decade pattern, closing prayers.
create table public.rosary_steps (
  id uuid primary key default gen_random_uuid(),
  phase text not null check (phase in ('opening', 'decade', 'closing')),
  sequence smallint not null check (sequence > 0),
  prayer_id uuid references public.prayers (id) on delete restrict,       -- null = announce the mystery
  repeat_count smallint not null default 1 check (repeat_count between 1 and 10),
  label_en text,
  label_ta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (phase, sequence)
);

-- ---------------------------------------------------------------------------
-- Saints
-- ---------------------------------------------------------------------------
create table public.saints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null,
  name_ta text not null,
  feast_month smallint check (feast_month between 1 and 12),
  feast_day smallint check (feast_day between 1 and 31),
  birth_year smallint,
  death_year smallint,
  patronage_en text,
  patronage_ta text,
  biography_en text,
  biography_ta text,
  image_media_id uuid references public.media (id) on delete set null,
  search_norm text generated always as (public.normalize_search_text(
    name_ta || ' ' || name_en || ' ' || coalesce(patronage_ta, '') || ' ' || coalesce(patronage_en, '')
  )) stored,
  source_id uuid not null references public.content_sources (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((feast_month is null) = (feast_day is null)),
  check (feast_month is null or make_date(2000, feast_month, feast_day) is not null)  -- 2000 is a leap year
);

create index saints_feast_idx on public.saints (feast_month, feast_day);
create index saints_search_trgm_idx on public.saints using gin (search_norm extensions.gin_trgm_ops);

alter table public.celebrations
  add constraint celebrations_saint_id_fkey foreign key (saint_id) references public.saints (id) on delete set null;
create index celebrations_saint_idx on public.celebrations (saint_id);

create table public.saint_prayers (
  saint_id uuid not null references public.saints (id) on delete cascade,
  prayer_id uuid not null references public.prayers (id) on delete cascade,
  sort_order smallint not null default 0,
  primary key (saint_id, prayer_id)
);

create index saint_prayers_prayer_idx on public.saint_prayers (prayer_id);

-- RLS ----------------------------------------------------------------------
select private.setup_content_table('public.media');
select private.setup_reference_table('public.prayer_categories');
select private.setup_content_table('public.prayers');
select private.setup_reference_table('public.rosary_mystery_sets');
select private.setup_content_table('public.rosary_mysteries');
select private.setup_reference_table('public.rosary_steps');
select private.setup_content_table('public.saints');
select private.setup_reference_table('public.saint_prayers');
