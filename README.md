# Catholic Bible & Prayer (working name)

A Tamil-first, English-supported Catholic platform: Bible, daily readings, liturgical calendar, prayers, Rosary and Saints.

- Requirements: [docs/PRD.md](docs/PRD.md)
- Plan and decisions: [docs/ANALYSIS.md](docs/ANALYSIS.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Database: [docs/DATABASE.md](docs/DATABASE.md)
- Content rights: [docs/CONTENT_RIGHTS.md](docs/CONTENT_RIGHTS.md)
- Importing content: [docs/IMPORT.md](docs/IMPORT.md)

## Getting started

Requires Node 20.9+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000 -> redirects to /ta
pnpm check        # lint, typecheck, tests, formatting
pnpm test:e2e     # end-to-end + accessibility tests (run pnpm build first)
pnpm db:test      # database migrations + pgTAP tests (needs local PostgreSQL + pgTAP, see docs/DATABASE.md)
```

## Status

- Phase 1 (foundation): done. App shell, Tamil/English routing, design system, themes, text sizing, PWA manifest.
- Phase 2 (database): done. Schema, row level security, publish guard, audit log, reference seed, pgTAP tests.
- Phase 3 (authentication and roles): done. Email-link and Google sign-in via Supabase, role-protected admin
  area, user and role management. To switch it on, see the Supabase setup steps in
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#setting-up-supabase).
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
- Next: Phase 10 (personal features).
