# Importing content

Content enters the database through import scripts, never through migrations or by hand. Source files stay
outside this repository (see [CONTENT_RIGHTS.md](CONTENT_RIGHTS.md)).

## Bible

```bash
# DATABASE_URL: direct Postgres connection (Supabase → Settings → Database → Connection string)
pnpm import:bible --preset en-drc --path /path/to/DRC.csv --dry-run
pnpm import:bible --preset en-drc --path /path/to/DRC.csv --publish
pnpm import:bible --preset ta-tcb2012 --path /path/to/Tamil-Bible-Database/MySQL
```

| Preset       | Source file                                                                                                | Licence (as recorded)           |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `en-drc`     | `formats/csv/DRC.csv` from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) | Public domain, verified         |
| `ta-tcb2012` | `MySQL/` folder of [jayarathina/Tamil-Bible-Database](https://github.com/jayarathina/Tamil-Bible-Database) | Unknown, **permission pending** |

What a run does:

1. **Parse** the source into books, verses (plain text + poetry / paragraph flags) and headings.
2. **Map numbering** to the reference versification (`scripts/import/bible/versification.ts`).
3. **Validate**: known books, continuous chapters, no duplicates or empty verses. Errors stop the import;
   verse gaps are warnings (some translations merge or omit verses).
4. **Load** in one transaction: the translation's books, verses and headings are replaced together.
   The run is logged in `import_batches` (status, counts, warnings, file checksum).
5. **Publish** only with `--publish`, and the database refuses unless the content source is verified with a
   known licence. Sources are created as described above but never changed by later imports: rights
   decisions are made by publishers.

`--dry-run` parses and validates without a database (or without writing, if `DATABASE_URL` is set).

### Numbering differences

Douay-Rheims follows the Latin Vulgate. The importer maps its psalm numbers and titles, and the Greek additions
to Daniel, onto the reference numbering. About 150 other chapters differ by a verse at a chapter boundary, and
Tobit, Judith and Sirach follow a different textual tradition. There the parallel view matches by verse number
and tells the reader that numbering can differ.

## Prayers

```bash
pnpm import:prayers --path data/import/prayers/traditional-en.json --publish
```

`data/import/prayers/traditional-en.json` holds 20 common prayers in their traditional English wording (public
domain), curated for this project, including everything the Rosary needs. Prayers are upserted by slug, and only the
fields in the file are written, so Tamil texts added by editors in the admin survive a re-import. Prayer text uses a
small format (lines, paragraphs, ℣/℟, _italic_, **bold**), described in `lib/prayers/markup.ts`.

## Lectionary and calendar

The Today page needs two steps after the Bible import:

```bash
# 1. Reading lists (references only, no reading texts) from jayarathina/Tamil-Catholic-Lectionary
pnpm import:lectionary --path /path/to/Tamil-Catholic-Lectionary/MySQL/liturgy_lectionary_table_readings__list.sql

# 2. Generate liturgical days (re-run yearly; days marked is_override are kept)
pnpm calendar:generate --calendar in --from 2025 --to 2030
```

- The lectionary import upserts one set per day ID ("OW05-0Sun A", "Saint Agnes, virgin and martyr", "_Martyr", …),
  replaces its readings and parses each reference ("எசா58:7-10") into verse ranges in the reference numbering.
  About 7% of rows are not references (pointers, Commons, sequence names) and are kept as display text.
- The generator writes each day's code, titles, colour, season, week and cycles, links its celebrations, and points
  each Mass (vigil, night, dawn, day, chrism) at its reading sets. Days whose readings are missing are reported.
- Reading text on the Today page comes from the published Bible translation in the reader's language, falling
  back to another published one, and is labelled with its source. The official Lectionary wording is not stored.

## Local development database

```bash
scripts/db/setup-local.sh app_dev                      # schema + seed in a local Postgres
DATABASE_URL=postgres://postgres@localhost:5432/app_dev pnpm import:bible --preset en-drc --path DRC.csv --publish
```

Browser tests that need data (Bible, lectionary, calendar): build with `NEXT_PUBLIC_SUPABASE_*` pointing at a Supabase (or PostgREST)
API over that database, then run `E2E_DATA=1 pnpm test:e2e`.
