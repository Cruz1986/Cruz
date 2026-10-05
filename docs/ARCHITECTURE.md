# Architecture

Target design: [ANALYSIS.md](ANALYSIS.md) §H–K. This file describes what is built.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 · next-intl 4 · Vitest.
Supabase (Postgres + Auth): see [DATABASE.md](DATABASE.md) and the auth section below. Playwright + axe for end-to-end tests.

## Layout

```text
app/
  [locale]/                 # ta | en (always prefixed; "/" redirects by preference)
    layout.tsx              # root layout: <html lang>, fonts, pre-paint prefs script, shell
    (public)/               # reader-facing pages (loading.tsx lives here)
    [...rest]/              # unknown paths -> localised 404
    error.tsx, not-found.tsx
  manifest.ts               # PWA manifest
  globals.css               # design tokens + Tamil typography
components/
  ui/                       # Button, Card, PageHeader, EmptyState, Skeleton, SegmentedControl, LiturgicalColorBadge
  layout/                   # SiteHeader, BottomNav, NavLink, LanguageSwitcher, SkipLink, nav-items
  preferences/              # PreferencesProvider (theme, text size), SettingsPanel
lib/
  i18n/                     # routing, request config, navigation, page helpers
  preferences/              # pure preference helpers + pre-paint script
  design/                   # liturgical colours
messages/ta.json, en.json   # UI strings (keys must match; enforced by tests)
supabase/                   # migrations, seed, pgTAP tests (see DATABASE.md)
scripts/db/test.sh          # local database test runner
proxy.ts                    # next-intl locale negotiation (Next 16 "proxy", formerly middleware)
```

## Key decisions

- **Static by default.** Every page is prerendered per locale. Anything that depends on the reader (date, theme,
  text size) is resolved on the client so pages stay cacheable.
- **"Today" uses the device time zone.** `TodayDate` renders on the client. The server default zone is `Asia/Kolkata`.
- **Theme and text size** are stored in `localStorage` and applied by an inline script before first paint (no flash).
  `html { font-size: calc(100% * var(--font-scale)) }` so every rem-based size scales, from 87.5% to 150%.
- **Semantic colour tokens** (`bg`, `surface`, `fg`, `accent`, `lit-*`) switch with `data-theme`, so components
  don't need `dark:` variants.
- **Tamil typography:** Noto Sans Tamil (UI) and Noto Serif Tamil (`reading` utility). Line height is 1.8 for UI and 2.0
  for reading. Tamil is never letter-spaced or upper-cased.
- **Tamil first.** `/` opens Tamil regardless of the browser language (many Tamil readers use phones set to English).
  A language the reader chose before is remembered by next-intl's locale cookie.
- **No sample content.** Modules show honest empty states until their data layer exists (PRD: content is data).

## Bible

```text
lib/content/bible.ts         data access (takes a client: anonymous for public pages, signed-in for staff preview)
lib/content/public-bible.ts  request-memoised published content for pages
lib/bible/                   reference parser ("John 3:16", "யோவா 3:16"), URL helpers, text normalisation
components/bible/            book list, chapter text (prose / poetry / headings), parallel view, verse selection,
                             reading position, reading-size control
app/[locale]/(public)/bible  /bible, /bible/<translation>, /<book>, /<chapter>, /<chapter>/<other translation>, /search
app/api/bible/*              JSON API (books, chapter, search)
scripts/import/              Bible importers (see IMPORT.md)
```

- Reader pages are **incrementally static**: generated on first visit, cached, refreshed hourly
  (`revalidate = 3600`). Every layout and page calls `setRequestLocale` (via `initPage`), which static rendering needs.
- Search and admin pages are dynamic. Search needs every word (substring match, so it works for Tamil) and can
  also take a reference ("John 3:16" jumps to the verse).
- Verse selection (tap to select, copy, share, copy link) is a client island over server-rendered text. The last
  chapter read is remembered on the device. Bookmarks, highlights and notes come with accounts in Phase 10.
- Staff can preview unpublished translations under Admin → Bible.

## Today and the liturgical calendar

```text
lib/liturgy/generate.ts   calendar engine: a TypeScript port of Roman-Calendar v5 (seasons, movable feasts,
                          precedence, transfers, memorials, colours), tested day by day against its 2026/2027 output
lib/liturgy/index.ts      season, week, Sunday cycle A/B/C, weekday cycle I/II, titles (English + Tamil)
lib/liturgy/lectionary.ts lectionary type codes, Tamil reference parser, lectionary set lookup
lib/liturgy/readings.ts   assembles a day's Masses (alternatives, shorter forms, memorial propers, Easter Vigil,
                          one reading before the Gospel on weekday feasts)
lib/content/today.ts      loads a generated day with its readings and fetches passage text by canonical verse key
scripts/calendar/         writes generated years into liturgical_days (admins can override single days)
app/[locale]/(public)/today      today (rendered for India's date; the browser moves to the reader's own date)
app/[locale]/(public)/today/[date]  any day, incrementally static
app/api/today             JSON API
lib/content/calendar.ts   a month of generated days with memorials
app/[locale]/(public)/calendar[/YYYY-MM]  month view (grid on wide screens, list on phones), days link to Today
app/api/calendar          JSON API (?month=YYYY-MM)
```

- The default calendar is the General Roman Calendar with India's proper calendar (`in`): Epiphany, Ascension
  and Corpus Christi on Sunday, plus India's proper celebrations. `gr` is available too.
- Lectionary references use the Tamil Bible's numbering, which is the reference versification, so passages
  are fetched from any published translation by canonical verse key, including Douay-Rheims psalms.
- Static pages built while the database is unreachable render the empty state instead of failing the build
  (`lib/content/build-safe.ts`). At runtime, errors keep the last good page.

## Prayers

```text
lib/prayers/markup.ts         constrained prayer format → structured lines (no HTML, nothing to inject)
lib/content/prayers.ts        categories and prayers (client passed in; public pages use the anonymous client)
app/[locale]/(public)/prayers library with instant search (titles and text) and device-saved favourites
app/[locale]/(public)/prayers/[slug]  prayer in the reader's language first, then the other; copy, share, save
app/[locale]/(admin)/admin/prayers    list, create, edit, review, publish, delete
lib/admin/prayer-form.ts      form validation and which statuses each role may set (unit tested)
lib/admin/prayer-actions.ts   server actions: check the role, then write as the user (RLS and the publish guard apply)
app/api/prayers[/slug]        JSON API
```

- Editors save drafts or send prayers for review; content admins publish, archive and delete. The database
  enforces the same rules and refuses to publish a prayer whose source isn't verified.
- Saving revalidates the public prayer pages in both languages straight away.
- Favourites are kept on the device until accounts arrive (Phase 10).

## Rosary

```text
lib/rosary/sequence.ts        step list → every prayer in order, decade starts, saved progress, today's set (unit tested)
lib/rosary/today.ts           today's set from the weekday and the liturgical season (India time zone)
lib/content/rosary.ts         sets, mysteries, steps and their prayers (null unless everything needed is published)
app/[locale]/(public)/rosary  today's mysteries first, the four sets, "continue where you left off"
app/[locale]/(public)/rosary/[set]  guided Rosary: one prayer at a time, bead counter, decade jumps, pause
app/api/rosary/[set]          JSON API (`today` for today's set)
```

- Sets follow the usual weekdays; on Sundays of Advent and Christmas the Joyful, and of Lent the Sorrowful
  mysteries are prayed.
- Progress is kept on the device for 24 hours (`rosary:progress` in local storage) and focus moves to each new
  prayer for screen readers. Arrow keys and the space bar move between prayers.
- Prayers come from the prayer library, so a Tamil text added there appears in the Rosary too.

## Saints

```text
lib/saints/helpers.ts         feast dates, life spans, search, the saints of a day (unit tested)
lib/content/saints.ts         saints, one saint with image and prayers, the saints of a date
app/[locale]/(public)/saints  Saint of the Day and every saint by month with instant search
app/[locale]/(public)/saints/[slug]  profile: feast, years, patronage, life, prayers, readings of the feast
app/[locale]/(admin)/admin/saints    list, create, edit, review, publish, delete
app/api/saints[/today|/search|/slug] JSON API
```

- The saints of a day are those whose celebrations the calendar keeps that day (`celebrations.saint_id`), then
  any other saint whose feast falls on that date (so Saint Paul appears on 29 June beside Saint Peter).
- The Today page and the home card link each celebration to its saint when the profile is published.
- Images come from the `media` table (Supabase storage bucket `media`) with alt text and attribution; uploading
  arrives with the admin CMS (Phase 11).

## Personal library

```text
lib/personal/store.ts         library model: keys, add/remove, merge of device and account (unit tested)
lib/personal/sync.ts          store items ↔ account rows (bookmarks, highlights, notes, favorites, history)
lib/personal/client.ts        browser store (local storage) + account sync, used through usePersonalStore()
lib/db/browser.ts             the reader's Supabase client in the browser (own rows only, by RLS)
components/personal/          library page, note dialog, favourite / note / history helpers, sync starter
app/[locale]/(public)/library My library: bookmarks, highlights, notes, favourites, recently opened, download
```

- Works without an account: everything is kept in the browser (`personal:v1`). Pages stay static; the library
  is drawn in the browser.
- Signed in: on each visit the device and the account are merged (newer version of an item wins, the device's
  new items are uploaded), and every change is written to both. If the account can't be reached the change
  stays on the device and is uploaded on the next visit.
- Signing out forgets the account's library on that device; a page load without a session does the same.
- Bible verses: tap to select, then bookmark, highlight (five colours) or add a note; marks are drawn on the
  verses. Prayers and saints: favourite and note buttons. Opening chapters, prayers and saints adds them to the
  history, which also powers "Continue reading".

## Authentication and roles

```text
proxy.ts            refreshes the Supabase session cookie; optimistic redirect of signed-out visitors away from /{locale}/admin
lib/auth/session.ts getSessionUser(): verified with the Auth server + roles from current_user_roles(), memoised per request
                    requireUser() / requireRoles(): every admin page calls these (layouts are display-only)
lib/auth/actions.ts sign in with an emailed link or Google, sign out (server actions)
app/api/auth/callback  exchanges the code / verifies the email token, then redirects to a same-origin ?next= only
lib/admin/*         admin server actions: check the role first, then run as the user so RLS checks again
```

- The browser only ever has the **publishable** key. All data access runs with the user's own session,
  so row level security applies. No service-role key is used anywhere in the app yet.
- Signed-in users without a staff role get a 404 on admin URLs, so the admin area isn't revealed.
- Without `NEXT_PUBLIC_SUPABASE_*` the app runs normally with sign-in switched off.

### Setting up Supabase

1. Create a project and apply the schema: `supabase link --project-ref <ref>`, then `supabase db push`. Load
   `supabase/seed.sql` once (SQL editor or `psql`).
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`.
3. Authentication → URL Configuration: set the Site URL and add `<SITE_URL>/api/auth/callback` to the
   Redirect URLs.
4. Optional: Authentication → Providers → Google (client ID and secret from Google Cloud).
5. Sign in once, then make yourself the first super admin in the SQL editor:

   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id from auth.users u, public.roles r
   where u.email = 'you@example.com' and r.key = 'super_admin';
   ```

   After that, manage roles in the app under Admin → Users & roles.

6. The migrations create a public Storage bucket `media` (images up to 15 MB) with upload rights for staff.

## Search

```text
lib/search/snippet.ts         query words, snippets around a match, verse keys of a reference (unit tested)
lib/content/search.ts         siteSearch(): reference + Masses where it is read, verses, all published content
app/[locale]/(public)/search  search page (header search icon); app/api/search: JSON
```

- A query that is a Bible reference ("Jn 3:16", "யோவா 3:16", "Ps 23") opens the passage and lists the upcoming
  days whose Mass readings include it (`days_with_passage`). Common lectionary abbreviations are book aliases.
- Other queries search verses in the reader's translation (`search_bible`, with "More in the Bible" for paging) and,
  in one call (`search_content`), prayers (texts too), saints (biographies too), Rosary mysteries, reflections and
  the celebrations the calendar keeps, with the next day each falls on.
- Every word must match; Tamil and English are normalised the same way (`normalize_search_text`) and use trigram
  indexes. Row level security applies, so only published content is found.

## Admin (content management)

| Area            | What staff do                                                                     | Who                       |
| --------------- | --------------------------------------------------------------------------------- | ------------------------- |
| Dashboard       | Items waiting for review, content by status, recent changes                       | Staff                     |
| Bible           | Translation details and status, book names and abbreviations, staff preview       | Staff; book names: admins |
| Calendar        | A day's title, colour and notes; celebration names and saints; reading references | Content admins            |
| Reflections     | Daily reflection per date and language, shown on the Today page                   | Staff                     |
| Prayers, Saints | Texts, biographies, images, workflow                                              | Staff                     |
| Rosary          | Mystery titles, Scripture, fruits, meditations                                    | Staff                     |
| Media           | Upload images (alt text, credit, source), attach to saints                        | Staff; delete: admins     |
| Sources         | Licence and permission of every source; only verified sources can be published    | Content admins            |
| History         | Every change, who made it, and the fields that changed                            | Staff                     |
| Users & roles   | Grant and revoke staff roles                                                      | Super admins              |

- Editors save drafts and send items for review; content admins publish, archive and delete. The database
  enforces the same rules (row level security and the publish guard), so the admin cannot bypass them.
- Forms are built from `components/admin/form-kit.tsx` and save through `adminSave` (`lib/admin/save.ts`): check
  the role, validate with zod, check the chosen status, write as the signed-in user, map database errors, refresh
  the public pages that show the item.
- Edits survive re-imports: celebration names edited in the admin are kept by `calendar:generate`
  (`names_locked`), corrected readings by `import:lectionary` (`is_edited`), and days marked "keep" are not
  regenerated (`is_override`).
- Images are uploaded from the browser straight to Storage (staff only, by storage policy), then recorded; if
  recording fails the file is removed. Public pages only show images that are published and from a verified source.

### Testing with a signed-in user

Browser tests for the admin and account sync sign a session cookie with the stack's JWT secret. Set
`E2E_JWT_SECRET`, `E2E_STAFF_ID` (a content admin in `auth.users`) and `E2E_USER_ID` (a reader); the auth
endpoint (`/auth/v1/user`) must accept that token, as a local PostgREST stack with a small auth stub does.

## Commands

| Command      | Purpose                                      |
| ------------ | -------------------------------------------- |
| `pnpm dev`   | Local development                            |
| `pnpm check` | Lint + typecheck + unit tests + format check |
| `pnpm build` | Production build                             |
