# Database

PostgreSQL schema for Supabase. Migrations: `supabase/migrations/`. Reference seed: `supabase/seed.sql`.
Tests: `supabase/tests/database/` (pgTAP).

## Running

| Where                      | How                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Supabase CLI (Docker)      | `supabase db reset` (migrations + seed), then `supabase test db`                               |
| Plain local PostgreSQL 15+ | `pnpm db:test`: builds a throwaway DB with a Supabase stand-in, applies everything, runs pgTAP |
| CI                         | `database` job in `.github/workflows/ci.yml` runs `pnpm db:test`                               |

`supabase/tests/support/supabase_shim.sql` creates what Supabase provides (`auth.users`, `auth.uid()`, the
`anon` / `authenticated` / `service_role` roles). It is only for local tests and is never applied to Supabase.

## Conventions

- UUID primary keys, `created_at` / `updated_at` (trigger-maintained), `text` + `CHECK` instead of enums.
- Row level security on **every** table (a test fails if one is missing).
- `public` holds API tables; `private` holds internal functions that API roles cannot call.
- Copyrighted text never goes in migrations or seed. Seed holds facts only: roles, calendars, Rosary set
  names, Bible book names.

## Access model

| Who                               | Can                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Anyone (`anon`)                   | Read published content whose source is verified, and reference data                          |
| Reader (`user`)                   | The above, plus their own profile preferences and personal data                              |
| `editor`                          | Read all content; create and edit drafts; submit for review (`in_review`)                    |
| `content_admin`                   | Everything an editor can, plus publish, unpublish, delete, manage sources and reference data |
| `super_admin`                     | Everything, plus users' roles                                                                |
| `service_role` (server / imports) | Bypasses RLS. Never exposed to the browser                                                   |

Enforced in the database, not only in the UI:

- **Publish guard.** A row can be `published` only if its `content_sources` row is `verified` with a known
  licence. Public reads re-check this, so restricting a source hides its content immediately.
- **Editors** cannot create, publish, edit or delete published content.
- **Audit log.** Every change to content and reference tables is recorded with before/after JSON and the
  actor. It is insert-only and readable by publishers. It doubles as revision history.
- **Personal tables** (`bookmarks`, `favorites`, `highlights`, `notes`, `history`,
  `notification_preferences`, `push_subscriptions`) are owner-only.
- **Profiles.** Users may change their preferences but not `disabled_at`. A disabled account loses its roles.

## Tables

| Area          | Tables                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity      | `profiles`, `roles`, `user_roles`                                                                                                                                                                                           |
| Governance    | `content_sources`, `credits` (view), `content_audit_log`, `import_batches`                                                                                                                                                  |
| Bible         | `bible_books`, `bible_book_names`, `bible_translations`, `bible_translation_books`, `bible_verses`, `bible_section_headings`, `versification_maps`, `bible_chapters` (view)                                                 |
| Liturgy       | `liturgical_calendars`, `celebrations`, `liturgical_days`, `liturgical_day_celebrations`, `liturgical_day_masses`, `lectionary_sets`, `lectionary_readings`, `lectionary_reading_ranges`, `lectionary_texts`, `reflections` |
| Prayer        | `prayer_categories`, `prayers`, `rosary_mystery_sets`, `rosary_mysteries`, `rosary_steps`                                                                                                                                   |
| Saints, media | `saints`, `saint_prayers`, `media`                                                                                                                                                                                          |
| Personal      | `bookmarks`, `favorites`, `highlights`, `notes`, `history`                                                                                                                                                                  |
| Notifications | `notification_preferences`, `push_subscriptions`, `notifications`                                                                                                                                                           |

## Bible model

- **Books.** `bible_books` is one master list in Catholic canon order (73 books), plus `ESG` / `DAG` for the
  Greek additions to Esther and Daniel. Some translations, including the Tamil common-language Bible, print
  these as separate books. Each translation's own book order lives in `bible_translation_books`.
- **Verse keys.** A verse is stored in its translation's own numbering (`book, chapter, verse, verse_part`, with
  chapter 0 for prologues such as Sirach's). It also gets a `canonical_vkey` (`canon_order × 1 000 000 +
chapter × 1 000 + verse`) in the reference versification, which is the Tamil common-language Bible's numbering:
  Hebrew psalm numbers with titles as verse 0, Joel 3 chapters, Malachi 4 chapters, and the Greek additions in
  `ESG` / `DAG`. Importers convert other schemes (e.g. the Vulgate numbering of Douay-Rheims). The parallel view
  aligns translations by this key.
- **Layout.** Verse text is plain text with `
` between poetry lines; `is_poetry`, `paragraph_end` and
  `verse_label` (e.g. "4-5" for merged verses) carry the rest. Headings live in `bible_section_headings`.
- **Search.** `search_bible(translation, query, limit, after)` requires every word (substring match, so it
  works for Tamil without a stemmer) and pages by a stable sort key. `text_norm` is NFC-normalised, lower-cased text with zero-width characters removed. It has a
  trigram index for substring and Tamil search. `tsv` is a `simple` full-text vector.

## Liturgy model

- `liturgical_days`: one row per calendar and date, generated by `pnpm calendar:generate` from the TypeScript
  engine (`day_code`, titles, `precedence` from the Table of Liturgical Days, `kind`, colour, season, week, cycles).
  Rows with `is_override` are never regenerated.
- `liturgical_day_celebrations`: the day's celebration plus memorials that may be kept.
- `liturgical_day_masses`: per Mass (`vigil`, `night`, `dawn`, `day`, `chrism`), the lectionary sets to use. Role
  `base` sets are merged; `memorial` sets supply optional readings and _proper_ readings (`is_proper`) that
  replace the weekday's.
- `lectionary_readings.source_type` keeps the original type code; `reading_type`, `sequence`, `alt_group` and
  `is_short` are decoded from it.

## Saints model

- `saints`: names and titles (`title_en`, `title_ta`, e.g. "bishop and doctor") in both languages, fixed feast date,
  years, patronage, biographies, optional image (`media`), source and workflow status. `search_norm` covers names,
  titles and patronage.
- `celebrations.saint_id` links calendar celebrations to the saint they honour; several celebrations may share a
  saint (Saint John the Baptist's birth and martyrdom).
- `saint_prayers` links saints to prayers in the library.

## Personal model

- Items are identified by stable keys rather than row ids, so the same item saved on two devices (or before
  signing in) merges into one: a verse is `<translation>/<BOOK>/<chapter>/<verse>`, a chapter
  `<translation>/<BOOK>/<chapter>`, prayers and saints are their slugs (`private.valid_entity_key`).
- `bookmarks`, `favorites`, `notes`: unique per user, type and key (one note per item).
- `highlights`: one per user and canonical verse, so a highlight shows in every translation; `location` is where
  it was made.
- `history`: chapters, prayers and saints opened; a trigger keeps the latest 200 per user.
- Owner-only RLS on every table; the browser writes them directly with the reader's own session.

## Search

- `search_norm` (normalised Tamil + English text, trigram-indexed) on prayers, saints, reflections, celebrations and
  Rosary mysteries; `bible_verses.text_norm` for Scripture.
- `search_content(query, from, calendar, limit)`: one call across that content; every word must match, title matches
  first, security invoker (published content only for the public).
- `days_with_passage(start, end, from, calendar, limit)`: upcoming days whose readings overlap a range of canonical
  verse keys.

## Admin support

- `celebrations.names_locked`, `lectionary_readings.is_edited`: set by the admin; the calendar generator and the
  lectionary importer keep those rows as edited.
- `admin_set_reading_reference()`: replaces a reading's reference and verse ranges in one transaction
  (content admins only).
- `reflections`: at most one published reflection per date and language.
- `content_audit_log` is readable by all staff; `staff_names()` gives staff display names for "changed by".
- Storage bucket `media` (created only where Supabase Storage exists): staff upload, content admins delete.

## Content-table checklist

A new publishable table needs `id`, `source_id`, `status`, `published_at`, `created_by`, `updated_by`,
`created_at` and `updated_at`. Then call `select private.setup_content_table('public.<table>')` in the
migration. Reference tables call `private.setup_reference_table`.
