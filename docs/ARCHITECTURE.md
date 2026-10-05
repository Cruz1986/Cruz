# Architecture

Target design: [ANALYSIS.md](ANALYSIS.md) §H–K. This file describes what is built.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS v4 · next-intl 4 · Vitest.
Supabase (Postgres, Auth, Storage) arrives in Phase 2–3.

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
- **No sample content.** Modules show honest empty states until their data layer exists (PRD: content is data).

## Commands

| Command      | Purpose                                      |
| ------------ | -------------------------------------------- |
| `pnpm dev`   | Local development                            |
| `pnpm check` | Lint + typecheck + unit tests + format check |
| `pnpm build` | Production build                             |
