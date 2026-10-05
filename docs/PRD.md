# Tamil + English Catholic Bible & Prayer App

Complete Product Requirements Document • Technical Architecture • Database • UI/UX • Claude Cowork Prompts

Version 1.0 | October 2026

## 1. Executive Summary

Build a Tamil-first, English-supported Catholic faith platform that combines Bible reading, daily Mass readings, the liturgical calendar, prayers, Rosary, Saints, reflections and personal spiritual tools in one fast, modern web/mobile experience. The product should be inspired by the breadth of established Catholic Tamil resources, but must use its own UX, architecture, branding and legally authorized content.

Primary outcome: a user should open the app and reach today's Catholic readings, Gospel, prayer or Rosary within one or two taps.

## 2. Product Goals

- Make Tamil Catholic Scripture and prayer content easy to read on mobile.
- Provide a reliable 'Today' experience driven by a structured liturgical calendar.
- Support Tamil, English and parallel Tamil/English reading.
- Provide a reusable content-management system instead of hard-coded content.
- Create a scalable foundation for Android/iOS apps and future AI features.
- Protect the project from copyright, licensing and content provenance problems.
## 3. Non-Goals for MVP

- Social network/community feed
- Parish/Mass locator
- Live streaming
- Full AI theological assistant
- Large audio catalogue
- User-generated public content
## 4. MVP Feature Scope

| Module | MVP capabilities | Priority |
|---|---|---|
| Home / Today | Date, liturgical day, readings, Gospel, saint, quick prayer | P0 |
| Bible | Tamil, English, parallel view, book/chapter/verse navigation, search | P0 |
| Daily Readings | First reading, Psalm, second reading when applicable, Gospel | P0 |
| Liturgical Calendar | Season, week, celebration, rank, color, saint, readings | P0 |
| Prayers | Categories, Tamil/English, search, favorite/share | P0 |
| Rosary | 4 mystery sets, guided sequence, decade counter, Tamil/English | P0 |
| Saints | Saint of day, profile, feast date, biography | P1 |
| Personal | Bookmarks, highlights, notes, reading history | P1 |
| Admin | Content CRUD, publish/unpublish, media, roles | P0 |
| Notifications | Daily reading/reminder infrastructure | P1 |

## 5. Recommended Technology Architecture

Recommended production stack:

| Layer | Recommendation | Reason |
|---|---|---|
| Web | Next.js + TypeScript | SEO, responsive UI, server rendering, mature ecosystem |
| UI | Tailwind CSS + accessible component library | Fast consistent responsive design |
| Database | PostgreSQL | Relational content model and strong querying |
| Backend | Next.js server/API layer or dedicated Node service | Shared TypeScript and simple deployment |
| Auth | Supabase Auth or equivalent | Email/Google auth and session management |
| Storage | Object storage | Images/audio/media |
| Search | Postgres full-text initially; dedicated search later | Start simple, scale when needed |
| Mobile later | Expo/React Native | Reuse backend and design system |
| Hosting | Vercel + managed Postgres/storage or equivalent | Fast deployment and CDN |

## 6. High-Level System Architecture

Client → Web/App UI → Authentication → API/Server Layer → PostgreSQL. Media is served from object storage/CDN. Admin users access protected content-management routes. A future AI layer should retrieve only authorized content from the application database.

## 7. Database Design

Core principle: content is data, not frontend code. Use UUID primary keys, created_at/updated_at timestamps, indexes on date/language/slug/search fields, and explicit provenance/license fields for reusable content.

| Table | Key columns | Purpose |
|---|---|---|
| users | id, email, display_name, preferred_language, theme, font_scale, created_at, updated_at | User account and preferences |
| roles | id, name, description | RBAC roles |
| user_roles | user_id, role_id | Many-to-many user roles |
| bible_translations | id, code, name, language, description, license_type, source, active | Authorized Bible translations |
| bible_books | id, testament, book_order, code, name_en, name_ta, slug | Bible book master |
| bible_chapters | id, book_id, chapter_number | Chapter master |
| bible_verses | id, chapter_id, verse_number, text, language, translation_id | Verse text |
| liturgical_dates | id, date, calendar_code, season, week_number, celebration, rank, color, notes | Calendar day |
| daily_readings | id, liturgical_date_id, reading_type, reference, bible_translation_id, sequence | Reading references |
| prayers | id, category_id, slug, title_en, title_ta, body_en, body_ta, status, source, license_type | Prayer content |
| prayer_categories | id, name_en, name_ta, slug, sort_order | Prayer taxonomy |
| rosary_mysteries | id, mystery_set, mystery_number, title_en, title_ta, meditation_en, meditation_ta | Rosary content |
| saints | id, slug, name_en, name_ta, feast_month, feast_day, biography_en, biography_ta, patronage, image_media_id | Saint profiles |
| reflections | id, liturgical_date_id, title_en, title_ta, body_en, body_ta, author, status | Optional reflections |
| media | id, type, storage_path, alt_en, alt_ta, source, license_type, attribution | Media/provenance |
| bookmarks | id, user_id, entity_type, entity_id, created_at | Generic bookmark |
| highlights | id, user_id, verse_id, color, note, created_at | Bible highlights |
| notes | id, user_id, entity_type, entity_id, body, created_at, updated_at | Private notes |
| reading_history | id, user_id, verse_id, last_read_at | Reading activity |
| favorites | id, user_id, entity_type, entity_id, created_at | Favorites |
| notifications | id, title_en, title_ta, body_en, body_ta, scheduled_at, status | Notification content |
| notification_preferences | user_id, daily_reading, rosary, prayer, saint_of_day, enabled | User notification settings |
| content_audit_log | id, user_id, entity_type, entity_id, action, before_json, after_json, created_at | Admin audit trail |

## 8. Relationships / ERD Logic

- bible_translations 1→N bible_verses; bible_books 1→N bible_chapters; bible_chapters 1→N bible_verses.
- liturgical_dates 1→N daily_readings; liturgical_dates 1→N reflections; saints can be associated with many liturgical dates through a junction table if multiple celebrations are required.
- prayer_categories 1→N prayers.
- users N→N roles through user_roles.
- users 1→N bookmarks/highlights/notes/favorites/history.
- media can be referenced by saints, prayers, reflections and other content through explicit foreign keys or a controlled media relation.
- All published content should carry source/license/provenance metadata where applicable.
## 9. Content Rights & Provenance

Do not copy text, images, audio, reflections, designs or database content from CatholicTamil, ArulVakku or any other website merely because it is publicly viewable. Bible translations and other devotional material can have separate rights. Store source, copyright holder, license type, permission status and attribution requirements where relevant.

| Field | Example values |
|---|---|
| license_type | public_domain / licensed / permission_granted / original / unknown |
| source | Publisher, diocese, author, archive, etc. |
| copyright_holder | Rights holder |
| permission_status | verified / pending / restricted |
| attribution | Required attribution text |
| import_date | Date content entered |
| reviewed_by | Admin/editor |

## 10. Screen-by-Screen UI Specification

| Screen | Main requirements | Priority |
|---|---|---|
| Splash / App Launch | Logo, language preference, session restore | P1 |
| Onboarding | Choose Tamil/English, font size, notification preferences | P1 |
| Home | Today card, Gospel, readings, saint, quick prayer, Rosary | P0 |
| Today | Full daily readings, liturgical info, saint, reflection | P0 |
| Bible Home | Translation, Testament, books, recent reading | P0 |
| Book / Chapter | Book list, chapter grid, last-read position | P0 |
| Bible Reader | Verse text, font controls, bookmark, highlight, note, share | P0 |
| Parallel Bible | Tamil and English aligned by verse | P0 |
| Bible Search | Keyword search, filters, results by verse | P0 |
| Prayer Home | Categories, featured prayers, search | P0 |
| Prayer Reader | Prayer text, language switch, favorite/share | P0 |
| Rosary Home | Mystery sets and introduction | P0 |
| Rosary Guided | Current mystery, prayer, counter, progress | P0 |
| Saint of Day | Photo, feast, biography, prayer | P1 |
| Saints Search | Search/filter saints | P1 |
| Calendar | Month/date navigation, liturgical color and celebrations | P0 |
| Bookmarks | Saved Bible verses/content | P1 |
| Highlights | Highlighted verses grouped by color/book | P1 |
| Notes | Private notes | P1 |
| Settings | Language, font, theme, notifications, account | P1 |
| Admin Dashboard | KPIs, pending content, recent changes | P0 |
| Admin Content | CRUD and publishing workflows | P0 |

## 11. Home Page UX

- Top: date + liturgical celebration.
- Primary card: Today's Gospel with a prominent Read button.
- Secondary: First Reading, Psalm, Second Reading where applicable.
- Saint of the Day card.
- Quick actions: Bible, Prayers, Rosary.
- Continue Reading card if the user has reading history.
- Bottom navigation on mobile: Home, Bible, Today, Prayers, More.
## 12. Bible Reader UX

- Readable Tamil typography with generous line height.
- Verse numbers visually distinct but not distracting.
- Tap verse to reveal actions: highlight, bookmark, note, copy, share.
- Persistent language/translation control.
- Remember last book/chapter/verse.
- Font size slider and dark/system themes.
- Previous/next chapter controls.
- Search should return exact verse references and context.
## 13. Rosary UX

- Show the selected mystery set before starting.
- Display current mystery and meditation.
- Show decade progress 1/5 and Hail Mary progress 1/10.
- Allow previous/next and pause/resume.
- Keep the interface prayer-focused and low distraction.
- Persist progress locally for interrupted sessions.
## 14. Admin Panel

| Area | Capabilities |
|---|---|
| Dashboard | Content counts, drafts, pending review, recent changes |
| Bible | Translations, books, chapters, verses, import/export |
| Calendar | Dates, seasons, celebrations, colors, readings |
| Readings | Assign references/content to dates |
| Prayers | Create/edit/preview/publish |
| Rosary | Mystery sets and meditations |
| Saints | Profiles, feast dates, media |
| Reflections | Draft/review/publish/schedule |
| Media | Upload, metadata, rights |
| Users | Search, roles, disable/enable |
| Audit | Who changed what and when |

## 15. API / Server Contract

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/today | Today's liturgical data and readings |
| GET | /api/calendar?month=YYYY-MM | Calendar entries |
| GET | /api/bible/books | Book list |
| GET | /api/bible/{translation}/{book}/{chapter} | Chapter verses |
| GET | /api/bible/search?q=... | Bible search |
| GET | /api/prayers | Prayer listing |
| GET | /api/prayers/{slug} | Prayer detail |
| GET | /api/rosary/{set} | Rosary mystery set |
| GET | /api/saints/today | Saint of day |
| GET | /api/saints/search?q=... | Saint search |
| POST | /api/user/bookmarks | Create bookmark |
| POST | /api/user/highlights | Create highlight |
| POST | /api/user/notes | Create note |
| GET | /api/user/history | Reading history |

## 16. Search Strategy

- MVP: PostgreSQL full-text search plus indexed language-specific text columns.
- Normalize Tamil/English search input where appropriate.
- Search results must return references, not huge content blobs.
- Later: add a dedicated search engine only when scale/quality justifies it.
- Future AI search must retrieve from the authorized content database and cite the underlying Bible/reference records.
## 17. AI Roadmap

| Phase | AI feature | Rule |
|---|---|---|
| AI-1 | Search assistant | Answer from authorized app content |
| AI-2 | Today's Gospel explanation | Clearly label generated explanation |
| AI-3 | Prayer recommendation | Use approved prayer corpus |
| AI-4 | Tamil simplification | Do not alter Scripture meaning |
| AI-5 | Study assistant | Retrieve relevant verses and references |
| AI-6 | Voice assistant | Speech-to-text + grounded response + text-to-speech |

## 18. Security Requirements

- Never expose database service keys in browser code.
- Use server-side authorization for admin actions.
- Use row-level security where supported.
- Validate all content-management inputs.
- Restrict media uploads by type and size.
- Audit privileged changes.
- Rate-limit authentication and search endpoints where appropriate.
- Separate public published content from drafts/private content.
## 19. Accessibility & Localization

- WCAG-oriented contrast and keyboard navigation.
- Screen-reader labels for icons and controls.
- Do not encode Tamil as images.
- Use Unicode Tamil text.
- Allow font scaling without breaking layout.
- Test long Tamil strings and mixed Tamil/English UI.
- Use locale-aware dates and numerals where appropriate.
## 20. Testing Strategy

| Layer | Tests |
|---|---|
| Unit | Database utilities, date calculations, reading selection, Rosary progression |
| Integration | API + database + auth |
| UI | Navigation, responsive behavior, reader controls |
| Content | Tamil/English rendering, references, duplicate detection |
| Security | RBAC, unauthorized admin/API access |
| Regression | Every release against Bible, Today, Calendar and Prayer flows |
| Performance | Page load, search latency, large chapter retrieval |
| Accessibility | Keyboard, screen reader, font scaling, contrast |

## 21. Release Roadmap

| Release | Scope |
|---|---|
| MVP / V1 | Bible, Today, Calendar, Prayers, Rosary, basic Saints, Admin |
| V1.1 | Accounts, bookmarks, highlights, notes, history, notifications |
| V2 | Audio, reading plans, novenas, richer Saints, offline support |
| V3 | AI assistant, grounded study/search, voice |
| V4 | Mobile apps, parish/diocese features, community features if desired |

## 22. Claude Cowork Master Prompt

Paste the following as the initial project instruction in Claude Cowork. It is intentionally designed to force analysis before code generation.

```text
You are the lead product architect, senior full-stack engineer, UI/UX designer, database architect and QA lead for this repository.
PROJECT:
Tamil + English Catholic Bible, Prayer, Rosary and Liturgical Calendar application.
MISSION:
Build a production-quality Catholic faith platform for Tamil and English users.
CORE MODULES:
1. Home / Today
2. Tamil Bible
3. English Bible
4. Parallel Bible
5. Bible Search
6. Daily Readings
7. Liturgical Calendar
8. Prayer Library
9. Interactive Rosary
10. Saints
11. Bookmarks
12. Highlights
13. Notes
14. Reading History
15. Notifications
16. Secure Admin CMS
TECHNICAL PREFERENCE:
Next.js
TypeScript
Tailwind CSS
PostgreSQL
Supabase or equivalent managed PostgreSQL/auth/storage
Responsive web first
Architecture ready for React Native/Expo later
NON-NEGOTIABLE:
Content must be database-driven.
Do not hard-code the Bible or large content collections in UI code.
Do not copy content from CatholicTamil, ArulVakku or other websites.
Do not use copyrighted content unless the project has permission/license.
Preserve source/license/provenance metadata.
Never expose secrets in client code.
Use RBAC for admin functions.
Use reusable components.
Avoid duplicate logic.
Use strict TypeScript.
Handle loading, error and empty states.
Make Tamil typography a first-class requirement.
FIRST ACTION — NO CODING:
Inspect the entire repository.
Produce:
A. Current architecture
B. File map
C. Existing dependencies
D. Database/content model
E. Missing requirements
F. Security risks
G. Copyright/content-rights risks
H. Proposed target architecture
I. Proposed folder structure
J. Proposed database schema
K. API design
L. Screen map
M. Implementation roadmap
N. Testing strategy
STOP AFTER THE ANALYSIS.
Do not create or modify application files until I approve the plan.
AFTER APPROVAL:
Implement one phase at a time.
For every phase:
1. Explain intended changes.
2. Implement.
3. Run type checks/lint/tests.
4. Fix errors.
5. Check regressions.
6. Report changed files.
7. Report remaining risks.
8. Update project documentation.
DEVELOPMENT ORDER:
Phase 1 — Foundation and design system
Phase 2 — Database and content models
Phase 3 — Authentication and roles
Phase 4 — Bible
Phase 5 — Today / Daily Readings
Phase 6 — Liturgical Calendar
Phase 7 — Prayer Library
Phase 8 — Rosary
Phase 9 — Saints
Phase 10 — Personal features
Phase 11 — Admin CMS
Phase 12 — Search
Phase 13 — Notifications
Phase 14 — Testing/performance/security
Phase 15 — Production deployment
QUALITY BAR:
The application must feel like a real production product, not an AI-generated demo.
Prioritize:
readability
speed
reliability
clean architecture
Tamil usability
accessibility
maintainability
content correctness
legal content provenance
```

## 23. Claude Cowork Phase Prompts

### Phase 1 — Foundation

Implement Phase 1 only. Create the production UI foundation, routing structure, responsive layout, typography system, theme system, navigation and reusable components. Do not populate large Bible/prayer datasets. Run checks and report all changed files.

### Phase 2 — Database

Implement Phase 2 only. Create the PostgreSQL schema and migrations for Bible, translations, liturgical dates, readings, prayers, Rosary, Saints, users, bookmarks, highlights, notes, history, media and audit logs. Add indexes and constraints. Do not invent copyrighted content.

### Phase 3 — Auth

Implement authentication and RBAC. Roles: Super Admin, Content Admin, Editor, User. Protect admin routes and server actions. Verify unauthorized users cannot mutate content.

### Phase 4 — Bible

Implement the Bible module using database-driven authorized content. Include translation selector, book/chapter navigation, reader, verse actions, parallel Tamil/English view, search and last-read state. Do not scrape external Bible websites.

### Phase 5 — Today

Implement the Today page. Select content from the user's local date and the configured liturgical calendar. Show celebration, season, readings, Gospel, Saint of Day and optional reflection. Support Tamil and English.

### Phase 6 — Calendar

Implement the liturgical calendar UI and data access layer. Support month/date navigation, liturgical color, season, week, celebration, rank, saints and readings. Keep the calendar data configurable rather than hard-coded.

### Phase 7 — Prayers

Implement the prayer library with categories, search, Tamil/English content, favorites and share/copy. Build admin CRUD and publishing workflow.

### Phase 8 — Rosary

Implement the interactive Rosary. Support Joyful, Sorrowful, Glorious and Luminous mysteries, guided sequence, decade progress, prayer counter, pause/resume and Tamil/English.

### Phase 9 — Saints

Implement Saints and Saint of Day. Build searchable profiles, feast dates, biography, patronage, images with rights metadata and related prayers.

### Phase 10 — Personal

Implement bookmarks, highlights, private notes, favorites and reading/prayer history. Ensure each feature is scoped to the authenticated user and cannot leak data between users.

### Phase 11 — Admin

Build the complete admin CMS for Bible metadata, readings, liturgical calendar, prayers, Rosary, Saints, reflections, media, users, roles and audit logs. Include draft/published states and validation.

### Phase 12 — Search

Implement global search across authorized Bible, prayers, Saints and readings. Optimize indexes and pagination. Return concise results with references.

### Phase 13 — Notifications

Implement the notification data model and user preferences. Add the infrastructure for daily readings, Saint of Day, prayer and Rosary reminders. Keep actual delivery provider abstracted.

### Phase 14 — QA

Perform a complete production-readiness review. Run tests, type checks, linting, security review, accessibility review, performance review and content integrity checks. Fix issues rather than only reporting them.

## 24. Data Import Strategy

- Prepare authorized source datasets separately from application code.
- Use CSV/JSON import scripts with validation.
- Validate book/chapter/verse numbering.
- Validate duplicate IDs and references.
- Validate language completeness.
- Validate reading references against the selected Bible translation.
- Log import batches and errors.
- Never overwrite production content without versioning/backups.
## 25. Suggested Initial Repository Structure

```text
app/
  (public)/
    page.tsx
    today/
    bible/
    prayers/
    rosary/
    saints/
    calendar/
  (auth)/
  admin/
components/
  bible/
  prayers/
  rosary/
  saints/
  calendar/
  layout/
  ui/
lib/
  auth/
  db/
  search/
  liturgy/
  content/
  validation/
  permissions/
types/
data/
  import/
scripts/
  migrations/
  imports/
public/
  icons/
  images/
docs/
  PRD.md
  CONTENT_RIGHTS.md
  ARCHITECTURE.md
```

## 26. First Milestone Acceptance Criteria

- Application opens with a polished responsive shell.
- Tamil and English language switching works.
- Today page loads from database/API architecture rather than hard-coded page content.
- Bible navigation architecture supports translation → book → chapter → verse.
- Prayer and Rosary modules have real content models.
- Admin role can manage content; normal users cannot.
- No secrets are exposed client-side.
- Database migrations are reproducible.
- Content rights metadata exists.
- No TypeScript/lint errors at milestone completion.
## 27. Final Product Principle

Build this as a content platform, not a collection of static pages. The most important long-term asset is the structured, searchable, legally authorized Catholic content database. The UI, mobile apps, notifications and future AI assistant should all consume the same underlying content and rules.

## Appendix A — Recommended Next Deliverables

- Detailed PostgreSQL SQL schema with CREATE TABLE statements.
- ERD diagram.
- Seed/import JSON templates for Bible, prayers, Saints and liturgical dates.
- Exact screen wireframes and component specifications.
- Admin CMS specification.
- Content licensing checklist.
- Bible data import/validation script.
- Liturgical calendar engine specification.
- AI/RAG architecture for the future Catholic assistant.
