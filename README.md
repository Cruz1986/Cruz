# Catholic Bible & Prayer (working name)

A Tamil-first, English-supported Catholic platform: Bible, daily readings, liturgical calendar, prayers, Rosary and Saints.

- Requirements: [docs/PRD.md](docs/PRD.md)
- Plan and decisions: [docs/ANALYSIS.md](docs/ANALYSIS.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Database: [docs/DATABASE.md](docs/DATABASE.md)
- Content rights: [docs/CONTENT_RIGHTS.md](docs/CONTENT_RIGHTS.md)
- Importing content: [docs/IMPORT.md](docs/IMPORT.md)
- Deploying to production: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Security and quality checks: [docs/SECURITY.md](docs/SECURITY.md), [docs/QUALITY.md](docs/QUALITY.md)

## Getting started

Requires Node 20.9+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000 -> redirects to /ta
pnpm check        # lint, typecheck, tests, formatting
pnpm test:e2e     # end-to-end + accessibility tests (run pnpm build first)
pnpm db:test      # database migrations + pgTAP tests (needs local PostgreSQL + pgTAP, see docs/DATABASE.md)
pnpm preflight --env-file .env.production.local --site   # production readiness (see docs/DEPLOYMENT.md)
```

## Status

- Phase 1 (foundation): done. App shell, Tamil/English routing, design system, themes, text sizing, PWA manifest.
- Phase 2 (database): done. Schema, row level security, publish guard, audit log, reference seed, pgTAP tests.
- Phase 3 (authentication and roles): done. Email-link and Google sign-in via Supabase, role-protected admin
  area, user and role management. To switch it on, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- Phase 4 (Bible): done. Book and chapter navigation, reader (Tamil typography, poetry, headings), side-by-side
  view, verse copy and share, search by words or reference, JSON API, import pipeline. Douay-Rheims is public;
  the Tamil Bible is imported for staff preview only until permission is confirmed.
- Phase 5 (Today): done. Liturgical calendar engine (General Roman + India), daily readings with alternatives,
  vigils and memorial propers, passage text, day navigation, home page Today card, `/api/today`.
- Phase 6 (calendar): done. Month view with liturgical colours, ranks, memorials and season changes, month
  navigation, links to each day's readings, `/api/calendar`.
- Phase 7 (prayers): done. Prayer library by category with search, prayer pages (Tamil first when available),
  copy, share and device favourites; admin create, edit, review, publish and delete; 20 public-domain English
  prayers. Tamil prayer texts are waiting for a source with clear rights.
- Phase 8 (Rosary): done. Guided Rosary for all four sets of mysteries, today's set by weekday and season,
  bead counter, decade jumps, keyboard control, pause and resume on the device, Scripture links, original
  meditations, `/api/rosary/[set]` (and `/api/rosary/today`). Tamil mystery titles need review.
- Phase 9 (Saints): done. Saint of the Day (from the calendar, with feast-date fallback), 201 saint profiles
  with Tamil names and titles from the calendar and original English biographies, search and month browsing,
  profiles with feast, life span, patronage, related prayers and a link to the feast's readings; links from
  Today and Home; staff admin; `/api/saints`, `/api/saints/today`, `/api/saints/search`, `/api/saints/[slug]`.
  Tamil biographies and saint images still to be added.
- Phase 10 (personal): done. My library with Bible bookmarks, five-colour highlights (shown in every
  translation), private notes on verses, prayers and saints, favourites, recently opened history and data
  download. Works on the device without an account and syncs to the reader's account when signed in
  (owner-only database access, merge on sign-in, cleared from the device on sign-out).
- Phase 11 (admin CMS): done. Dashboard with review queue and recent changes; editors for calendar days,
  celebrations and reading references (kept on re-import), daily reflections (shown on Today), Rosary mysteries,
  Bible translations and book names, media uploads with alt text and credit (saint images), sources and
  licences, and a change history with field-by-field differences.
- Phase 12 (search): done. One search for the Bible (references open the passage and list the upcoming Masses
  where it is read; words find verses), prayers, saints, Rosary mysteries, reflections and calendar
  celebrations with their next date, in Tamil and English; `/api/search`.
- Phase 13 (notifications): done. Daily reminder at the reader's chosen time and time zone with the parts they
  choose (Gospel, saint of the day, Rosary, a prayer for the hour), one notification in their language; device
  opt-in with Web Push and a test button; announcements scheduled by content admins; a scheduled job that sends
  each reminder once; delivery behind a provider interface (Web Push or log).
- Phase 14 (testing, performance and security): done. Security headers and CSP, RLS and function checks over the
  whole database, a client-bundle secret check in CI, search rate limits; JavaScript per page roughly halved and
  Bible search up to 140× faster; accessibility checks on every section and the admin; page-weight budgets and a
  load test. See docs/SECURITY.md and docs/QUALITY.md.
- Phase 15 (production deployment): ready to deploy. Step-by-step runbook for Supabase, Vercel and GitHub; workflows
  that deploy the database (migrations + reference seed) and import all public content from pinned, checksummed
  sources; a reminder scheduler that works on free plans (late runs delay reminders instead of losing them);
  `pnpm preflight` checks variables, database and the live site; `pnpm admin:grant` makes the first admin;
  sitemap with hreflang, robots (previews not indexed), health endpoint, structured error logs, a last-resort
  error page; Sources & credits page from the database; privacy page; readers can delete their account.
