# Catholic Bible & Prayer (working name)

A Tamil-first, English-supported Catholic platform: Bible, daily readings, liturgical calendar, prayers, Rosary and Saints.

- Requirements: [docs/PRD.md](docs/PRD.md)
- Plan and decisions: [docs/ANALYSIS.md](docs/ANALYSIS.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Content rights: [docs/CONTENT_RIGHTS.md](docs/CONTENT_RIGHTS.md)

## Getting started

Requires Node 20.9+ and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3000 -> redirects to /ta
pnpm check        # lint, typecheck, tests, formatting
```

## Status

Phase 1 (foundation) is done: app shell, Tamil/English routing, design system, themes, text sizing, PWA manifest.
Next: Phase 2 (database schema and migrations).
