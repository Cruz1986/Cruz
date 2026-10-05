# Security

How the app protects readers' data, the content and the staff tools, and how that is tested. Report a
vulnerability privately to the project lead; do not open a public issue.

## What we protect

| Asset                                                     | Threats                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| Readers' notes, highlights, bookmarks, history, devices   | Another reader or a visitor reading or changing them           |
| Unpublished and unlicensed content (e.g. the Tamil Bible) | Exposure before permission is granted                          |
| The staff tools                                           | Use by non-staff; editors exceeding their role                 |
| Server secrets (service role key, VAPID key, cron secret) | Leaking into the browser or the repository                     |
| The service                                               | Abuse of expensive endpoints (search), injection, clickjacking |

## Controls

**Data access lives in the database.** Every table has row level security (checked by a test over all tables):
public readers see only published content from verified sources; staff rights follow their role; personal tables
are owner-only. Server actions check the role first and then write as the signed-in user, so the database checks
again. The publish guard refuses to publish anything whose source is not verified with a known licence.

**Functions.** Owner-rights (`security definer`) functions all pin `search_path` (tested); anonymous visitors can
call only the two role checks. The scheduled job's reader list (`due_reminders`) is service-role only;
`delete_my_account` acts only on the caller's own account. Bible
search builds its query from LIKE-escaped words quoted with `format('%L')`; there is no other dynamic SQL.

**Secrets.** Only `NEXT_PUBLIC_*` values reach the browser; `lib/db/service.ts` and the notification provider are
`server-only` modules. `pnpm check:bundle` (in CI) fails if a secret's name or value appears in the built browser
files. `.env*` files are not committed.

**Browser hardening.** Content-Security-Policy limits sources to the site and the Supabase project (no
`frame-ancestors`, no plugins, form posts only to the site, Supabase Auth and Google sign-in); HSTS on HTTPS;
`X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, `Cross-Origin-Opener-Policy`, and a restrictive
`Permissions-Policy`. Scripts allow `'unsafe-inline'` because statically generated pages cannot carry a
per-request nonce; React escapes all text and the app renders no user-supplied HTML (the one inline script is a
constant). A browser test checks the main pages for CSP violations.

**Input.** Every form and API validates its input (zod on the server); text lengths, slugs, dates, references,
URLs (announcements open in-app paths only) and storage paths are checked. Sign-in's `next` parameter only ever
leads to a path on this site (tested against `//`, `/\` and absolute URLs).

**Abuse.** Search APIs allow 60 requests a minute per visitor and server instance (429 with `Retry-After`); the
reminder job needs the `CRON_SECRET` (compared in constant time); Supabase rate-limits sign-in e-mails.

**Accounts and devices.** Signing out clears the account's library from the device and stops push
notifications there. Readers can delete their account and all their personal data (Account page). Image uploads go straight to storage under staff-only policies with type and size checks.

## Checks to run

| What                    | How                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| Dependencies            | `pnpm audit --prod` (no known vulnerabilities at Phase 14)       |
| Database rules          | `scripts/db/test.sh` (RLS per table, roles, workflow, functions) |
| Secrets in the bundle   | `pnpm build && pnpm check:bundle`                                |
| Headers, CSP, redirects | `pnpm test:e2e tests/e2e/security.spec.ts`                       |
| Production settings     | `pnpm preflight --env-file .env.production.local --site`         |

## Before launch

- Rotate every key used during development; set production secrets only in the hosting provider (mark them
  Sensitive in Vercel). `pnpm preflight` refuses a secret in any `NEXT_PUBLIC_` variable.
- In Supabase: enable leaked-password protection and e-mail confirmation, restrict the Auth redirect URLs to the
  production domain, and keep the service role key out of every client.
- Review staff accounts and roles (Admin → Users & roles).
