# Quality: tests, performance and accessibility

## Test suites

| Suite            | Command                                         | Covers                                                                                                                         |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Unit             | `pnpm test`                                     | Calendar engine, readings, references, search, Rosary, saints, personal library, reminders, providers, forms, CSP, rate limits |
| Database (pgTAP) | `scripts/db/test.sh`                            | Schema, RLS for every role, publishing workflow, imports, search, notifications, security rules                                |
| Browser          | `pnpm build && pnpm test:e2e`                   | Every section on phone and desktop, accessibility (axe), security headers, page-weight budgets                                 |
| With data        | `E2E_DATA=1 pnpm test:e2e`                      | The same against imported content                                                                                              |
| Signed in        | `E2E_JWT_SECRET`, `E2E_USER_ID`, `E2E_STAFF_ID` | Account sync, reminders, the admin                                                                                             |
| Bundle secrets   | `pnpm check:bundle`                             | No server secret in browser files                                                                                              |
| Load             | `pnpm load-test --url …`                        | Throughput and latency under concurrent visitors                                                                               |

CI runs lint, types, unit tests, formatting, the build, the bundle check, the browser tests and the database tests
on every pull request.

## Performance (Phase 14)

Measured on the production build (mobile profile, cold cache, local database):

| Measure                                  | Before       | After        |
| ---------------------------------------- | ------------ | ------------ |
| JavaScript per page (compressed)         | about 330 KB | about 175 KB |
| Fonts per page                           | 186 KB       | 97–134 KB    |
| Bible search, rare words ("loved world") | 875 ms       | 6 ms         |
| Bible search, Tamil word                 | 92 ms        | 4 ms         |
| Largest contentful paint, typical page   | 130–280 ms   | 110–260 ms   |
| Layout shift                             | 0            | 0            |

What changed: the personal library no longer ships a validation library, and the account client loads only for
signed-in readers; Tamil fonts load only on pages that use them; Bible search lets the trigram index find rare
words. `tests/e2e/performance.spec.ts` keeps JavaScript under 220 KB and fonts under 150 KB per page.

Load test (`pnpm load-test`, 50 concurrent visitors, one Node process on 4 cores): about 200 requests a second,
median 230 ms, no errors. Pages are statically generated and refreshed in the background, so a CDN serves most
traffic in production.

## Accessibility

axe (WCAG 2.2 A/AA) runs on every public section in Tamil and English, the admin, the verse toolbar and note
dialog, the Rosary guide, and dark mode with every highlight colour. The Rosary can be prayed with the keyboard
alone, and focus follows each step so screen readers announce it. Tamil text is never letter-spaced or
upper-cased; text size follows the reader's setting.
