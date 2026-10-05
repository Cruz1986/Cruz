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
- **Personal tables** (`bookmarks`, `favorites`, `highlights`, `notes`, `reading_history`,
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
| Personal      | `bookmarks`, `favorites`, `highlights`, `notes`, `reading_history`                                                                                                                                                          |
| Notifications | `notification_preferences`, `push_subscriptions`, `notifications`                                                                                                                                                           |

## Bible model

- **Books.** `bible_books` is one master list in Catholic canon order (73 books), plus `ESG` / `DAG` for the
  Greek additions to Esther and Daniel. Some translations, including the Tamil common-language Bible, print
  these as separate books. Each translation's own book order lives in `bible_translation_books`.
- **Verse keys.** A verse is stored in its translation's own numbering (`book, chapter, verse, verse_part`). It
  also gets a `canonical_vkey` (`canon_order × 1 000 000 + chapter × 1 000 + verse`) in the reference
  versification: Hebrew-numbered Psalms, Joel 4 chapters, Malachi 3, Daniel 14. `versification_maps` holds the
  differences. Parallel view, lectionary ranges and highlights all use the canonical key.
- **Search.** `text_norm` is NFC-normalised, lower-cased text with zero-width characters removed. It has a
  trigram index for substring and Tamil search. `tsv` is a `simple` full-text vector.

## Content-table checklist

A new publishable table needs `id`, `source_id`, `status`, `published_at`, `created_by`, `updated_by`,
`created_at` and `updated_at`. Then call `select private.setup_content_table('public.<table>')` in the
migration. Reference tables call `private.setup_reference_table`.
