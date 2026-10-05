# Pre-Implementation Analysis

Response to the "First action — no coding" step of the master prompt in [PRD.md](./PRD.md) §22.
No application code has been written. Implementation starts only after this plan is approved.

Status: **approved 2026-10-05** · Phases 1–13 implemented

---

## A. Current architecture

There is none yet. The repository holds one commit ("Add files via upload") with one file:

| Path      | What it is                                                    |
| --------- | ------------------------------------------------------------- |
| `1NL.png` | 335×183 logo: "1NL — 1 FOR ALL FOR 1", blue and yellow ribbon |

There's no framework, package manifest, database, CI, or license file. This is a greenfield build.

## B. File map

```text
/
├── 1NL.png          # logo (relation to this product unconfirmed, see open question Q1)
└── docs/
    ├── PRD.md       # PRD v1.0, converted from the supplied .docx
    └── ANALYSIS.md  # this document
```

## C. Existing dependencies

None. Proposed dependencies (pinned at the Phase 1 install):

| Concern             | Choice                                                                       | Notes                                                    |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Runtime             | Node 22 LTS, pnpm                                                            |                                                          |
| Framework           | Next.js (App Router) + React, TypeScript `strict`                            | Server Components by default                             |
| Styling             | Tailwind CSS v4 + Radix UI primitives (via shadcn/ui-style local components) | Accessible primitives, no heavy runtime                  |
| i18n                | `next-intl`                                                                  | Locale-prefixed routes, ICU messages, Tamil plural rules |
| DB / Auth / Storage | Supabase (Postgres 16, Auth, Storage)                                        | RLS is native; local stack via Supabase CLI              |
| Migrations          | Plain SQL via Supabase CLI + `supabase gen types`                            | RLS/policies/triggers stay first-class SQL               |
| Validation          | Zod                                                                          | Shared by server actions, API routes and import scripts  |
| Fonts               | Noto Serif Tamil, Noto Sans Tamil, Inter (self-hosted via `next/font`)       | Unicode Tamil, no images of text                         |
| Testing             | Vitest, Playwright, `@axe-core/playwright`, pgTAP                            | pgTAP covers RLS policy tests                            |
| Quality             | ESLint (next + typescript-eslint strict), Prettier, `tsc --noEmit`           | CI gate                                                  |
| Rate limiting       | Upstash Ratelimit, or a Postgres-backed limiter                              | Search and auth endpoints                                |

## D. Database / content model (state of the PRD model)

There's no existing database. The PRD §7 model is a good start, but it has these gaps. Section J fixes them.

1. **`users` clashes with Supabase `auth.users`.** Use `public.profiles` (1:1 with `auth.users.id`) for preferences.
2. **Provenance fields are defined (§9) but not attached to any table.** `copyright_holder`, `permission_status`, `attribution`, `import_date` and `reviewed_by` appear nowhere in §7. They should be normalised into a `content_sources` table that every content row references.
3. **`bible_verses.language` is redundant** with `translation_id → language`. Worse, verses link only to a chapter. **There's no way to align Tamil and English for the parallel view when versification differs.**
4. **Versification is not modelled.** The Psalms are numbered differently (Hebrew vs Greek/Vulgate). Malachi 3/4, Joel 2/3 and chapter breaks also differ. Esther and Daniel have deuterocanonical additions. A canonical verse key and per-translation mapping are required.
5. **The Catholic canon (73 books) isn't stated.** Books also need a deuterocanonical flag.
6. **`daily_readings.reference` is a free-text string.** It can't be validated against a translation (as §24 requires). It can't express non-contiguous ranges (`Is 7:10-14; 8:10`), optional/alternative readings, or the Easter Vigil's nine readings. It also can't hold the responsorial psalm refrain or the Gospel acclamation.
7. **Lectionary ≠ Bible.** Mass readings use the _Lectionary_ text, which can differ from the same translation's Bible text and is licensed separately. The model must allow stored lectionary text, not only verse references.
8. **One celebration per day is assumed.** Days can carry an obligatory memorial plus optional memorials, or a commemoration. That needs a `liturgical_celebrations` junction (also mentioned in §8).
9. **No lectionary cycle columns.** Sunday cycle A/B/C, weekday cycle I/II and psalter week 1–4 are missing.
10. **No calendar _engine_.** `liturgical_dates` is a table of rows, but something must generate those rows. That means Easter computus, moveable feasts, Ordinary Time numbering, precedence/transfer rules and the national calendar (e.g. India transfers Epiphany and Ascension to Sunday). Diocesan or national overrides must also stay configurable.
11. **Rosary has only mysteries.** A guided Rosary also needs the ordered step sequence: Sign of the Cross, Creed, Our Father, 3 Hail Marys, Glory Be, Fatima Prayer, Hail Holy Queen, and the closing prayer. It also needs the default day-of-week → mystery-set mapping.
12. **No content status, versioning or scheduling** beyond `prayers.status` and `reflections.status`. Every publishable entity needs `draft → in_review → published → archived`, `published_at`, and revision history (§24: "never overwrite without versioning").
13. **No slugs per language, no `sort_order` on many lists, no soft delete.**
14. **No import batch tracking** (§24 "log import batches and errors").

## E. Missing requirements (product)

| #   | Gap                                                                                                                  | Proposal                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E1  | **Which Bible translations are licensed?** Nothing can ship without this.                                            | Blocking decision, see Q2                                                                         |
| E2  | Which **calendar** is "Today" based on: General Roman, India national, or a specific Tamil Nadu diocese?             | Default to General Roman + India national; add diocese overrides later                            |
| E3  | **Time zone.** "Today" must follow the user's local date (PRD §Phase 5), but Server Components render on the server. | Client sends `tz` cookie. Server resolves the date in that tz, default `Asia/Kolkata`             |
| E4  | **URL strategy for languages** is unspecified                                                                        | `/ta/...` and `/en/...` prefixes (SEO, shareable links), with `/` redirecting by preference       |
| E5  | **Accounts in MVP?** §21 puts accounts in V1.1, but MVP needs Admin, so auth is needed.                              | MVP: auth for staff only. Personal features ship in V1.1, using local-only bookmarks before login |
| E6  | **Offline / PWA.** V2 per roadmap, but notifications (§Phase 13) on web need a service worker.                       | Add a minimal PWA shell in Phase 1. Offline content comes in V2                                   |
| E7  | **Share** behaviour (verse image? text? deep link?)                                                                  | Text plus a canonical deep link in MVP. Share images come later                                   |
| E8  | **Tamil search input**: no Postgres Tamil stemmer exists, and users may type romanised Tamil ("Tanglish")            | `simple` config + `pg_trgm` + NFC normalisation. Transliteration in a later phase                 |
| E9  | **Privacy / compliance**: India DPDP Act 2023, account deletion, notes are sensitive spiritual data                  | Privacy policy, account-deletion flow, no third-party analytics on reader pages by default        |
| E10 | **Ecclesiastical approval** (imprimatur) for translations and prayer versions shown as "Catholic"                    | Store `ecclesiastical_approval` on sources. Show it in the about/credits screen                   |
| E11 | **Branding / product name** not given                                                                                | Q1                                                                                                |
| E12 | No **analytics / KPIs** defined for the admin dashboard beyond content counts                                        | Content counts + publish queue in MVP. Usage analytics later, privacy-first                       |
| E13 | **Accessibility target** says "WCAG-oriented"                                                                        | Commit to WCAG 2.2 AA                                                                             |
| E14 | **Performance budgets** not quantified                                                                               | Target LCP < 2.5 s on mid-range Android over 4G, and search p95 < 300 ms                          |

## F. Security risks

| Risk                                                         | Mitigation (where)                                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase **service-role key** leaking into the client bundle | Only in `lib/db/admin.ts` marked `import 'server-only'`. Never in `NEXT_PUBLIC_*`. A CI grep check fails the build if it appears in `.next/static` |
| **Admin checks only in UI**                                  | Every mutation goes through server actions that call `requireRole()`, **and** RLS policies enforce the same roles in Postgres (defence in depth)   |
| **Draft content leaking** via public API/queries             | Public reads go through `published_*` views / RLS `status = 'published' and published_at <= now()`                                                 |
| **Cross-user data leaks** (bookmarks, notes, highlights)     | RLS `user_id = auth.uid()` on all personal tables, verified with pgTAP tests per table                                                             |
| **Stored XSS** from CMS rich text (prayers, biographies)     | Store Markdown (constrained subset). Render with a sanitising renderer. No `dangerouslySetInnerHTML`                                               |
| **Stale role claims** in JWT after demotion                  | Roles read from `user_roles` on the server per request (cached briefly), not trusted from client claims                                            |
| **Audit log tampering**                                      | `content_audit_log` is insert-only: no UPDATE/DELETE policy, rows written by trigger                                                               |
| **Malicious uploads**                                        | Storage buckets restricted by MIME and size. Images re-encoded. No SVG uploads from the CMS                                                        |
| **Bulk import abuse / corruption**                           | Imports run as CLI scripts or Super-Admin-only actions, in a transaction with dry-run and batch log                                                |
| **Search / auth abuse**                                      | Rate limits per IP and per user. Query length caps                                                                                                 |
| **CSRF on server actions**                                   | Next.js origin checks + SameSite cookies. No mutating GET routes                                                                                   |
| **Secrets in repo**                                          | `.env*` git-ignored, `.env.example` only, secret scanning in CI                                                                                    |

## G. Copyright / content-rights risks

This section is about risk, not legal advice. Rights status below must be verified with the publisher or rights holder before anything ships.

| Content                                                                                                     | Risk                                                                                                                        | Recommended stance                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tamil Catholic Bible** (e.g. திருவிவிலியம் — the common-language Catholic translation used in Tamil Nadu) | Believed to be under active copyright held by a Church body. Shown publicly on other sites, but that grants no rights to us | **Obtain written permission** before import. Until then, dev uses clearly marked placeholder verses                                                              |
| **Tamil Protestant translations** (e.g. the older Union Version)                                            | Possibly public domain, but Protestant canon (no deuterocanon) and not Catholic-approved                                    | Don't present as a Catholic Bible                                                                                                                                |
| **English Catholic Bibles** (NABRE, RSV-2CE, NRSV-CE, Jerusalem, NJB)                                       | Copyrighted, with licensing terms per publisher                                                                             | License one, or use **Douay-Rheims (public domain)** as the free fallback                                                                                        |
| **Lectionary texts** (Tamil and English)                                                                    | Licensed separately from Bibles, and responsorial psalms (e.g. Grail) are separately copyrighted                            | Store references only until the lectionary is licensed. Show "read in your translation"                                                                          |
| **Liturgical texts** (ICEL English Mass texts, Tamil Missal)                                                | Copyrighted                                                                                                                 | Avoid. Traditional prayers (Our Father, Hail Mary, Glory Be, Apostles' Creed in traditional wording) are generally safe, but confirm each Tamil version's source |
| **Saint biographies**                                                                                       | Copying websites is infringement                                                                                            | Write original bios, with author and editor recorded                                                                                                             |
| **Saint images**                                                                                            | Many online icons are copyrighted photos of PD artworks                                                                     | Wikimedia Commons PD/CC only, with attribution stored in `media`                                                                                                 |
| **Reflections**                                                                                             | Authored content                                                                                                            | Original or contracted. Author is recorded                                                                                                                       |
| **CatholicTamil / ArulVakku** (named in PRD)                                                                | Expressly excluded                                                                                                          | No scraping, no data copy, no UI imitation                                                                                                                       |
| **`1NL.png` logo**                                                                                          | Ownership and intended use unknown                                                                                          | Confirm (Q1)                                                                                                                                                     |

**Enforcement in the system:** every content row has `source_id NOT NULL`. A publish is blocked by a DB check or trigger unless the source's `permission_status = 'verified'` and `license_type <> 'unknown'`. A public `/credits` page is generated from `content_sources`.

## H. Proposed target architecture

```text
Browser / PWA (Next.js RSC + client islands)
   │  locale-prefixed routes (/ta, /en), tz cookie
   ▼
Next.js server (Vercel)
   ├── Server Components ── read via lib/content/* (typed queries, published-only)
   ├── Route handlers /api/* ── public JSON contract (PRD §15), for future mobile app
   ├── Server actions ── mutations, requireRole() + Zod
   └── lib/liturgy ── pure TS calendar engine (computus, seasons, precedence)
   ▼
Supabase
   ├── Postgres (RLS on every table; views for published content; FTS + pg_trgm)
   ├── Auth (email + Google)
   └── Storage (media bucket, CDN)
Offline/CLI
   └── scripts/import (CSV/JSON → validate → transaction → import_batches log)
```

Principles:

- **One data-access layer** (`lib/content`). Pages, API routes and future mobile clients use the same functions, so logic isn't duplicated.
- **The calendar engine is pure TypeScript** with exhaustive unit tests. It _generates_ `liturgical_days` rows for a year/calendar. Admins then override individual days. The UI reads only from the DB.
- **Caching:** published content uses ISR / `revalidateTag` keyed by entity. Publish actions revalidate tags.
- **Mobile later:** the `/api` routes + Zod schemas are the shared contract. Tokens and design primitives live in `lib/design` so Expo can reuse them.

## I. Proposed folder structure

The PRD §25 structure, adjusted for locale routing and server-only boundaries:

```text
app/
  [locale]/
    (public)/
      page.tsx                 # Home
      today/[[...date]]/
      bible/[translation]/[book]/[chapter]/
      bible/parallel/[book]/[chapter]/
      bible/search/
      calendar/[[...month]]/
      prayers/  prayers/[slug]/
      rosary/  rosary/[set]/
      saints/  saints/[slug]/
      credits/
    (account)/ bookmarks/ highlights/ notes/ settings/
    (auth)/ login/ callback/
  admin/                       # not localised, staff UI in English + Tamil labels
    (dashboard)/ bible/ calendar/ readings/ prayers/ rosary/ saints/
    reflections/ media/ users/ audit/ sources/
  api/                         # PRD §15 contract
components/
  ui/ layout/ bible/ prayers/ rosary/ saints/ calendar/ admin/
lib/
  auth/          # requireUser, requireRole (server-only)
  db/            # supabase clients: server, browser, admin(server-only)
  content/       # typed published-content queries
  liturgy/       # calendar engine (pure, tested)
  bible/         # reference parser, versification mapping
  search/
  validation/    # zod schemas
  permissions/
  i18n/          # next-intl config, messages/ta.json, messages/en.json
  design/        # tokens shared with future mobile
types/
supabase/
  migrations/  seed.sql  tests/        # pgTAP
scripts/
  import/                              # bible, prayers, saints, calendar importers
data/
  import/templates/                    # JSON/CSV templates, no copyrighted text
public/ icons/ images/
docs/ PRD.md ANALYSIS.md ARCHITECTURE.md CONTENT_RIGHTS.md IMPORT.md
tests/ e2e/ unit/
```

## J. Proposed database schema (summary)

Conventions: `uuid` PKs (`gen_random_uuid()`), `created_at` and `updated_at` (trigger), `timestamptz`, `text` with CHECK constraints instead of Postgres enums (easier to migrate), and RLS enabled on every table.

**Rights and workflow (shared)**

- `content_sources`(id, name, copyright_holder, license_type ∈ {public_domain, licensed, permission_granted, original, unknown}, permission_status ∈ {verified, pending, restricted}, attribution_text, ecclesiastical_approval, license_url, notes, reviewed_by → profiles, reviewed_at)
- Columns shared by all publishable content: `source_id NOT NULL`, `status ∈ {draft, in_review, published, archived}`, `published_at`, `created_by`, `updated_by`
- `content_revisions`(id, entity_type, entity_id, revision_no, data jsonb, created_by, created_at)
- `content_audit_log`(id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at). Insert-only, trigger-written.
- `import_batches`(id, kind, source_id, file_name, checksum, status, row_count, error_count, errors jsonb, started_by, started_at, finished_at)

**Identity**

- `profiles`(id = auth.users.id, display_name, preferred_language ∈ {ta, en}, theme, font_scale, timezone, disabled_at)
- `roles`(id, key ∈ {super_admin, content_admin, editor, user}, description) and `user_roles`(user_id, role_id, PK both)
- SQL helper `has_role(text)`, `security definer`, used in RLS.

**Bible**

- `bible_translations`(id, code UNIQUE, name, language, versification_scheme, canon ∈ {catholic, protestant}, source_id, status)
- `bible_books`(id, code UNIQUE (OSIS-style, e.g. `GEN`, `TOB`), testament, canon_order, is_deuterocanonical, name_en, name_ta, abbr_en, abbr_ta, slug_en, slug_ta)
- `bible_book_names`(book_id, language, name, alias). Lookup for reference parsing ("மத்", "Mt", "Matt").
- `bible_verses`(id, translation_id, book_id, chapter, verse, verse_suffix (for "a/b" splits, e.g. Esther additions), text, text_norm, tsv tsvector GENERATED, canonical_key, UNIQUE(translation_id, book_id, chapter, verse, verse_suffix))
  - Chapters are derived (`bible_chapters` becomes a view or materialised table with verse counts) to avoid redundant writes.
  - `canonical_key` (e.g. `PSA.051.003` in a reference scheme) aligns verses across translations for the parallel view.
- `versification_maps`(scheme, book_id, chapter, verse, canonical_key). Seeded from public versification data.
- Indexes: GIN on `tsv`, GIN trigram on `text_norm`, btree on `(translation_id, book_id, chapter)`.

**Liturgy**

- `liturgical_calendars`(id, code (e.g. `gr`, `in`, `in-madras-mylapore`), parent_id, name)
- `liturgical_days`(id, calendar_id, date, season ∈ {advent, christmas, ordinary, lent, triduum, easter}, week_number, sunday_cycle ∈ {A, B, C}, weekday_cycle ∈ {I, II}, psalter_week, color ∈ {green, violet, white, red, rose, black, gold}, notes, is_override, UNIQUE(calendar_id, date))
- `celebrations`(id, slug, name_en, name_ta, rank ∈ {solemnity, feast, memorial, optional_memorial, commemoration, weekday}, precedence int, color, saint_id NULL, source_id)
- `liturgical_day_celebrations`(day_id, celebration_id, is_primary, sort_order)
- `lectionary_sets`(id, code, description). One reading set per Mass (e.g. "Christmas – Mass at Night").
- `lectionary_readings`(id, set_id, reading_type ∈ {first, psalm, second, acclamation, gospel, vigil_n}, sequence, reference_display, is_optional, alternative_group)
- `lectionary_reading_ranges`(reading_id, book_id, chapter_start, verse_start, chapter_end, verse_end, sequence). This is the parsed, validated form.
- `lectionary_texts`(reading_id, language, text, refrain, source_id). Optional, used only when lectionary text is licensed.
- `liturgical_day_masses`(day_id, celebration_id NULL, lectionary_set_id, label_en, label_ta, sort_order)
- `reflections`(id, day_id, language, title, body_md, author, status, source_id, published_at)

**Prayers, Rosary, Saints**

- `prayer_categories`(id, slug, name_en, name_ta, sort_order)
- `prayers`(id, category_id, slug, title_en, title_ta, body_en_md, body_ta_md, status, source_id, sort_order, tsv)
- `rosary_mystery_sets`(id, key ∈ {joyful, sorrowful, glorious, luminous}, name_en, name_ta, default_weekdays int[])
- `rosary_mysteries`(id, set_id, number 1–5, title_en, title_ta, scripture_reference, fruit_en, fruit_ta, meditation_en_md, meditation_ta_md, source_id, status)
- `rosary_steps`(id, sequence, phase ∈ {opening, decade, closing}, prayer_id, repeat_count). The guided sequence is data, not hard-coded logic.
- `saints`(id, slug, name_en, name_ta, feast_month, feast_day, birth_year, death_year, patronage_en, patronage_ta, biography_en_md, biography_ta_md, image_media_id, source_id, status)
- `saint_prayers`(saint_id, prayer_id)
- `media`(id, kind, storage_path, mime, bytes, width, height, alt_en, alt_ta, source_id, attribution_text)

**Personal (V1.1, RLS `user_id = auth.uid()`)**

- `bookmarks`, `favorites`(id, user_id, entity_type, entity_id, created_at, UNIQUE(user_id, entity_type, entity_id))
- `highlights`(id, user_id, translation_id, canonical_key, color, created_at). Highlights are keyed by canonical verse, so they survive a translation switch.
- `notes`(id, user_id, entity_type, entity_id, body, created_at, updated_at)
- `reading_history`(user_id, translation_id, book_id, chapter, verse, last_read_at, PK(user_id, translation_id))

**Notifications**

- `notification_preferences`(user_id PK, enabled, daily_reading, saint_of_day, prayer, rosary, preferred_time, timezone)
- `push_subscriptions`(id, user_id, endpoint, keys jsonb, created_at)
- `notifications`(id, kind, title_en, title_ta, body_en, body_ta, scheduled_at, status, provider_ref)

Entity-type polymorphism (`entity_type`, `entity_id`) is limited to user-owned tables, with a CHECK on allowed types. Content-to-content links use real FKs.

## K. API design

The PRD §15 contract, refined. All responses are JSON validated by shared Zod schemas, and every response includes `source` attribution.

| Method      | Endpoint                                                             | Notes                                                                                                       |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET         | `/api/today?date=YYYY-MM-DD&cal=in&lang=ta`                          | `date` defaults to today in the request tz. Returns day, celebrations, masses → readings, saint, reflection |
| GET         | `/api/calendar?month=YYYY-MM&cal=in`                                 | Compact per-day: color, rank, primary celebration                                                           |
| GET         | `/api/bible/translations`                                            | Added                                                                                                       |
| GET         | `/api/bible/books?translation=`                                      | With chapter counts                                                                                         |
| GET         | `/api/bible/{translation}/{book}/{chapter}`                          | Verses with `canonical_key`                                                                                 |
| GET         | `/api/bible/parallel/{book}/{chapter}?a=&b=`                         | Added. Aligned by canonical key                                                                             |
| GET         | `/api/bible/passage?ref=Mt+5:1-12&translation=`                      | Added. Resolves reading references                                                                          |
| GET         | `/api/bible/search?q=&translation=&testament=&book=&cursor=`         | Rate-limited, keyset pagination, returns reference + snippet                                                |
| GET         | `/api/prayers?category=&q=` / `/api/prayers/{slug}`                  |                                                                                                             |
| GET         | `/api/rosary/{set}` / `/api/rosary/today`                            | `today` picks the set by weekday + season                                                                   |
| GET         | `/api/saints/today` / `/api/saints/search?q=` / `/api/saints/{slug}` |                                                                                                             |
| GET         | `/api/search?q=&types=`                                              | Phase 12 global search                                                                                      |
| POST/DELETE | `/api/user/bookmarks`, `/highlights`, `/notes`, `/favorites`         | Auth required. DELETE added                                                                                 |
| GET/PUT     | `/api/user/history`, `/api/user/preferences`                         |                                                                                                             |

Admin mutations are server actions, not public REST. Error shape: `{ error: { code, message } }` with proper HTTP status codes.

## L. Screen map

```text
Home ─┬─ Today ── Reading detail (passage view, opens Bible at verse)
      ├─ Bible ── Book list ── Chapter grid ── Reader ⇄ Parallel
      │            └─ Search ── result → Reader@verse
      ├─ Calendar ── Day → Today(date)
      ├─ Prayers ── Category ── Prayer reader
      ├─ Rosary ── Set picker ── Guided (opening → 5 decades → closing)
      └─ More ── Saints (today, search, profile) · Bookmarks · Highlights · Notes
                 · Settings · Credits/Sources · Login
Admin ── Dashboard · Sources · Bible · Calendar · Readings · Prayers · Rosary
         · Saints · Reflections · Media · Users/Roles · Audit · Imports
```

Mobile bottom nav: **Home · Bible · Today · Prayers · More** (per PRD §11). Desktop uses a top bar + sidebar.

Every data screen gets designed loading (skeleton), empty and error states.

## M. Implementation roadmap

This follows the PRD's 15 phases. Each phase ends with typecheck, lint, tests, a changed-files report and doc updates.

| Phase            | Deliverable                                                                                                                                        | Notes / changes vs PRD                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1 Foundation     | Next.js app, Tailwind tokens, Tamil typography, theme (light/dark/system), font scaling, locale routing, app shell + nav, UI kit, PWA manifest, CI |                                                                      |
| 2 Database       | Migrations for §J, RLS policies, pgTAP tests, seed with **placeholder-only** content + DR (public domain) sample                                   | Includes `content_sources` and publish-guard trigger                 |
| 3 Auth/RBAC      | Supabase Auth, roles, `requireRole`, protected `/admin`                                                                                            |                                                                      |
| 4 Bible          | Reference parser, versification, reader, parallel, search v1, last-read (local storage before login)                                               |                                                                      |
| 5 Today          | Uses calendar engine output                                                                                                                        | **Calendar engine built here, before Phase 6** (Today depends on it) |
| 6 Calendar       | Month UI, day detail, overrides                                                                                                                    |                                                                      |
| 7 Prayers        | Library + admin CRUD + publish workflow                                                                                                            |                                                                      |
| 8 Rosary         | Data-driven guided flow, local progress persistence                                                                                                |                                                                      |
| 9 Saints         | Profiles, saint of day, media rights                                                                                                               |                                                                      |
| 10 Personal      | Bookmarks, highlights, notes, favorites, history                                                                                                   | V1.1                                                                 |
| 11 Admin         | Remaining CMS, revisions, audit viewer, imports UI                                                                                                 | Basic CRUD already arrives with each module                          |
| 12 Search        | Global search                                                                                                                                      |                                                                      |
| 13 Notifications | Prefs, web push via provider abstraction, scheduler                                                                                                | V1.1                                                                 |
| 14 QA            | Full review and fixes                                                                                                                              | Testing also runs every phase, not only at the end                   |
| 15 Deploy        | Vercel + Supabase prod, backups, monitoring, rollback runbook                                                                                      |                                                                      |

**Content track (parallel, non-code, owned by you):** secure Bible, lectionary and prayer permissions, and write saint bios. The app can be built fully on placeholder and public-domain data, but **MVP launch is blocked on licensed Tamil Scripture.**

## N. Testing strategy

| Layer         | Tooling                               | Key cases                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit          | Vitest                                | Computus for 1900–2100 against known Easter dates. Season boundaries. Precedence/transfer (e.g. a solemnity falling on a Lent Sunday). Sunday/weekday cycle. Reference parser (`Is 7:10-14; 8:10`, Tamil book abbreviations). Versification mapping. Rosary state machine (step, decade, bead, resume) |
| DB            | pgTAP                                 | Each RLS policy: anon sees only published content. User A can't read user B's notes. Editor can't publish if the workflow says so. Audit log is insert-only. Publish guard blocks `unknown` licenses                                                                                                   |
| Integration   | Vitest + local Supabase               | API routes against a seeded DB. Server actions reject unauthorised roles                                                                                                                                                                                                                               |
| E2E           | Playwright                            | Home → Today → Gospel in ≤ 2 taps. Bible navigation + parallel. Rosary full run + resume. Admin create → publish → visible publicly                                                                                                                                                                    |
| Content       | Import validators                     | Book/chapter/verse continuity, duplicates, language completeness, every lectionary range resolves in the target translation                                                                                                                                                                            |
| Accessibility | axe + manual                          | WCAG 2.2 AA, keyboard paths, screen-reader labels, 200% font scale without layout break, long Tamil strings                                                                                                                                                                                            |
| Visual / i18n | Playwright screenshots                | Tamil + English, light/dark, 360 px and desktop                                                                                                                                                                                                                                                        |
| Performance   | Lighthouse CI, query `EXPLAIN` checks | Budgets from E14. Large chapter (Ps 119) render                                                                                                                                                                                                                                                        |
| Security      | CI checks                             | No service key in client bundle, dependency audit, secret scan                                                                                                                                                                                                                                         |

---

## Decisions

| #   | Question       | Decision                                                                                                        |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| Q1  | Branding       | `1NL.png` is **not** related to this project. Working name "Catholic Bible & Prayer" until a brand is chosen    |
| Q2  | Tamil Bible    | Open. Development uses placeholder or permission-pending data only (see [CONTENT_RIGHTS.md](CONTENT_RIGHTS.md)) |
| Q3  | English Bible  | Open. Default: Douay-Rheims (public domain)                                                                     |
| Q4  | Calendar       | Open. Default: General Roman + India national calendar                                                          |
| Q5  | Infrastructure | Open. Default: Supabase + Vercel                                                                                |
| Q6  | MVP accounts   | Open. Default: staff-only auth in MVP, personal features in V1.1                                                |

Defaults apply until you say otherwise. Data sources are evaluated in [CONTENT_RIGHTS.md](CONTENT_RIGHTS.md).

## Changes made during implementation

| Planned (§J)                                              | Built (Phase 2)                                                                                                             | Why                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `content_revisions` table                                 | `content_audit_log` stores before/after of every change and serves as revision history                                      | One mechanism instead of two                                                            |
| `bible_books` = 73 books                                  | 73 + `ESG` / `DAG` supplements, and per-translation order in `bible_translation_books`                                      | The Tamil Bible prints the Greek additions as separate books, in a different order      |
| `canonical_key` text                                      | `canonical_vkey` integer                                                                                                    | Compact, and verse ranges become simple `between` queries                               |
| `reflections.day_id`                                      | `reflections.reflection_date`                                                                                               | Regenerating calendar days must never orphan reflections                                |
| `rosary_steps.prayer_id` required                         | Nullable: a step without a prayer means "announce the mystery"                                                              | The guided flow needs that step                                                         |
| Reference versification "as NABRE" (Hebrew verse numbers) | The Tamil common-language Bible's numbering (English-style)                                                                 | The primary translation then needs no mapping; only Douay-Rheims (Vulgate) is converted |
| Admin CMS for the Bible in Phase 11                       | Phase 4 adds a read-only Admin → Bible page with staff preview                                                              | Staff need to see the Tamil text while it can't be public                               |
| `liturgical_days` as the only per-day data                | Days also store the engine's day code, titles, precedence and kind; Masses link reading sets with a role (base / memorial)  | Today renders from one query; memorial propers are applied when the page is built       |
| Lectionary texts in `lectionary_texts`                    | Not imported. Readings show Bible passages by verse range, labelled with the translation                                    | The Lectionary wording is licensed separately                                           |
| Saint of the Day from `saints` feast dates                | From the celebrations the calendar keeps that day (`celebrations.saint_id`), then saints whose feast falls on the date      | Follows transferred and impeded celebrations; shared feasts (Peter and Paul) show both  |
| Personal features in V1.1, keyed by row ids               | Built in Phase 10: device-first library that syncs to the account when signed in; items keyed by location or slug           | Works for readers without an account; the same item saved on two devices merges cleanly |
| `reading_history` (last position per translation)         | `history` of chapters, prayers and saints (latest 200)                                                                      | One list serves "Continue reading" and prayer/saint history                             |
| Audit log readable by publishers                          | Readable by all staff; names shown through `staff_names()`                                                                  | Editors need to see what changed in the content they work on                            |
| Admin edits overwritten by imports                        | `celebrations.names_locked`, `lectionary_readings.is_edited` and `liturgical_days.is_override` are respected by the scripts | Corrections made in the admin are not lost on the yearly regeneration                   |
| One notification per enabled kind                         | One daily reminder combining the chosen parts, at one chosen time; deliveries logged per reader and local date              | Fewer interruptions; sending is idempotent however often the job runs                   |
