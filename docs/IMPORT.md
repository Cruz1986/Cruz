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

## Local development database

```bash
scripts/db/setup-local.sh app_dev                      # schema + seed in a local Postgres
DATABASE_URL=postgres://postgres@localhost:5432/app_dev pnpm import:bible --preset en-drc --path DRC.csv --publish
```

Browser tests that need Bible data: build with `NEXT_PUBLIC_SUPABASE_*` pointing at a Supabase (or PostgREST)
API over that database, then run `E2E_BIBLE=1 pnpm test:e2e`.
