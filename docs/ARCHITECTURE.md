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

## Commands

| Command      | Purpose                                      |
| ------------ | -------------------------------------------- |
| `pnpm dev`   | Local development                            |
| `pnpm check` | Lint + typecheck + unit tests + format check |
| `pnpm build` | Production build                             |
