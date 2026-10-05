# Deploying to production

The app runs on **Vercel** (Next.js, Mumbai region) with **Supabase** (Postgres, Auth, Storage) in Mumbai, close to
readers in Tamil Nadu. **GitHub Actions** checks every change, deploys the database, imports content and, by
default, triggers the daily reminders.

```text
GitHub ──push to main──▶ Vercel builds and deploys the app (Preview for pull requests)
   │                         │  NEXT_PUBLIC_* values are fixed at build time: redeploy after changing them
   ├─ CI                     ▼
   ├─ Deploy database ──▶ Supabase: migrations + seed.sql (reference data)
   ├─ Import content ───▶ Supabase: Bible, prayers, Rosary, lectionary, calendar, saints (by hand, yearly)
   └─ Reminders ────────▶ GET /api/cron/notifications every 15 minutes (with CRON_SECRET)
```

Plan names and limits below were right when this was written; check the providers' pricing pages.

## 1. Supabase project

1. Create a project in **South Asia (Mumbai)**. Keep the database password in a password manager.
2. **Project Settings → API**: note the project URL, the **publishable** key (or legacy `anon`) and the **secret**
   key (or legacy `service_role`). The secret key bypasses row level security: it goes only into server variables.
3. **Connect → Session pooler**: copy the connection string (`postgres://postgres.<ref>:<password>@aws-…pooler.supabase.com:5432/postgres`).
   Use the session pooler, not the direct connection: the direct one needs IPv6, which GitHub's runners lack.
   Percent-encode special characters in the password.

## 2. Database and content (GitHub)

1. **Settings → Environments → New environment** `production`. Add the secret `SUPABASE_DB_URL` (the session pooler
   string). Optionally add yourself as a required reviewer, so every database change waits for approval.
2. **Actions → Deploy database → Run workflow.** It applies all migrations and `supabase/seed.sql` (roles, calendars,
   Bible book names, Rosary sets, prayer categories). Later it runs by itself whenever a migration changes on `main`.
3. **Actions → Import content → Run workflow.** It downloads the two public-domain sources at pinned versions
   (checking their SHA-256), then imports Douay-Rheims, the 20 prayers, the Rosary, the lectionary reading lists,
   the calendar (last year to four years ahead) and the 201 saints. About a minute. Safe to re-run: edits made in
   the admin are kept. **Run it again each year** (or with other years) to extend the calendar.

The Tamil Bible is not imported: its permission is pending (see [CONTENT_RIGHTS.md](CONTENT_RIGHTS.md)).

The same steps from your computer: `supabase db push --db-url "$SUPABASE_DB_URL" --include-seed`, then
`DATABASE_URL="$SUPABASE_DB_URL" scripts/import/all.sh ./sources`.

## 3. Sign-in (Supabase Auth)

1. **Authentication → URL Configuration**: Site URL `https://<your domain>`. Redirect URLs:
   `https://<your domain>/api/auth/callback` and, for previews, `https://*-<vercel team>.vercel.app/api/auth/callback`.
2. **Authentication → Emails → SMTP settings**: connect an email service (Resend, Amazon SES, Brevo, …) and send from
   your domain. Supabase's built-in email is for trying things out: it sends only a few messages an hour and only to
   your team's addresses, so readers would never receive their sign-in link.
3. Optional, **Google**: in Google Cloud, create an OAuth client (Web application) with the authorised redirect URI
   `https://<project ref>.supabase.co/auth/v1/callback`; paste its ID and secret in **Authentication → Providers →
   Google**. Publish the OAuth consent screen with the app's name, domain and privacy policy.

## 4. The app (Vercel)

1. **Add New → Project**, import this repository. Framework: Next.js (detected). Production branch: `main`.
2. **Settings → Environment Variables** (Production):

   | Variable                               | Value                                               |
   | -------------------------------------- | --------------------------------------------------- |
   | `NEXT_PUBLIC_SITE_URL`                 | `https://<your domain>` (no trailing slash)         |
   | `NEXT_PUBLIC_SUPABASE_URL`             | project URL                                         |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key                                     |
   | `SUPABASE_SERVICE_ROLE_KEY`            | secret key — **Sensitive**                          |
   | `CRON_SECRET`                          | `openssl rand -hex 32` — **Sensitive**              |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`         | from `npx web-push generate-vapid-keys`             |
   | `VAPID_PRIVATE_KEY`                    | from the same command — **Sensitive**               |
   | `VAPID_SUBJECT`                        | `mailto:<an address you read>`                      |
   | `CONTACT_EMAIL`                        | address for privacy questions (shown on `/privacy`) |

   For **Preview**, set only the three `NEXT_PUBLIC_SUPABASE_*`/site variables (a separate staging project is
   better still). Previews are never indexed (`robots.txt` blocks them) and do not send reminders.

3. Deploy. **Settings → Domains**: add your domain and follow the DNS instructions; then redeploy, because
   `NEXT_PUBLIC_SITE_URL` is built into the pages (links, sitemap, security headers).

`vercel.json` runs the app's functions in Mumbai (`bom1`), next to the database.

## 5. Reminders

The job `GET /api/cron/notifications` must be called every 15 minutes with `Authorization: Bearer <CRON_SECRET>`.
It looks back an hour, so a late or missed call delays reminders without losing or doubling them. Choose one:

- **GitHub (default, free)**: **Settings → Secrets and variables → Actions**: secrets `SITE_URL` and `CRON_SECRET`
  (the same value as in Vercel), variable `REMINDER_SCHEDULER` = `github`. The `Reminders` workflow then runs every
  15 minutes; GitHub may start runs a few minutes late. GitHub pauses scheduled workflows in public repositories
  after 60 days without commits: re-enable it under Actions if that happens.
- **Vercel Cron** (paid plan; the free plan allows one run a day): add
  `"crons": [{ "path": "/api/cron/notifications", "schedule": "*/15 * * * *" }]` to `vercel.json`. Vercel sends the
  `CRON_SECRET` header itself. Leave `REMINDER_SCHEDULER` unset.
- **Any other scheduler** that can send the header (an uptime service, Supabase `pg_cron` + `pg_net`).

On phones, reminders need the browser's permission (Settings → Daily reminder → Turn on); on iPhone the site must
first be added to the Home Screen (iOS 16.4 or later).

## 6. First administrator

Sign in to the site once with your address, then:

```bash
DATABASE_URL="<session pooler string>" pnpm admin:grant --email you@example.org
```

You are then a super admin; give other staff their roles in the app under **Admin → Users & roles**.

## 7. Check before announcing

```bash
vercel env pull --environment=production .env.production.local   # or write the file by hand; never commit it
pnpm preflight --env-file .env.production.local --site
```

It checks the variables (https addresses, no secret in a browser variable, key formats, a strong cron secret), the
database (reference data, published content, today's liturgical day, a super admin) and the live site (health,
security headers, robots and sitemap, the job refusing unsigned calls). Fix every ✗; read every !.

Then by hand, on a phone, in Tamil and English: Today, a Bible chapter, a prayer, the Rosary, a saint, search;
sign in by email link and by Google; save a highlight and see it on a second device; turn on the reminder and press
**Send a test**; open the admin, edit a reflection and see it on Today; with a spare account, delete it on the
Account page and check that it cannot sign in to the same library again.

Submit `https://<your domain>/sitemap.xml` in Google Search Console.

## Releasing changes

1. Open a pull request. CI runs lint, types, unit tests, the build, the bundle secret check, browser and
   accessibility tests, and the database tests. Vercel builds a preview.
2. Merge to `main`. Vercel deploys the app and **Deploy database** applies new migrations, at the same time.
   So a migration must keep the current app working: add columns and tables freely; to rename or drop, first
   release code that no longer uses the old name, then remove it in a later migration.
3. After a release with migrations, run `pnpm preflight … --site` again.

**Rolling back**: in Vercel, **Deployments → (previous) → Instant Rollback** restores the app in seconds.
Migrations only move forward: undo one with a new migration.

## Backups and monitoring

- **Backups**: Supabase's paid plans keep daily backups (point-in-time recovery is an add-on); the free plan keeps
  none you can restore. Either way, keep your own: `pg_dump "$SUPABASE_DB_URL" -Fc -f backup-$(date +%F).dump`, for
  example weekly, stored outside Supabase. Content can always be re-imported, but readers' libraries, notes,
  reflections and admin edits exist only in the database.
- **Uptime**: point an uptime monitor at `https://<your domain>/api/health` (200 when the database answers, 503 if
  not).
- **Errors**: server errors are logged as one JSON line each (Vercel → Logs). The error page shows readers a
  reference (`digest`); search the logs for it.
- **Reminders**: GitHub emails you when a `Reminders` run fails (for example a changed `CRON_SECRET`). The job's
  response lists how many reminders it sent.
- **Rate limits** on search are per server instance (see [SECURITY.md](SECURITY.md)); add a firewall rule in
  Vercel if the site is ever flooded.

## Before launch: content

- The Tamil Bible stays a draft until its permission is confirmed in writing.
- A Tamil speaker should review the Rosary mystery titles, the Tamil prayer names in reminders
  (`lib/notifications/compose.ts`) and the interface wording.
- Saint biographies are original English texts: have them reviewed; Tamil biographies and images can be added in
  the admin.
- Read the privacy page (`/privacy`) against how you run the site, set `CONTACT_EMAIL`, and use its address as the
  privacy policy link on the Google consent screen. Readers can delete their account on the Account page.
