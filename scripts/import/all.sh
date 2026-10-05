#!/usr/bin/env bash
# Loads all public content into the database at DATABASE_URL, in dependency order. Safe to re-run: every import
# upserts, and edits made in the admin are kept (see docs/IMPORT.md).
#   DATABASE_URL=… scripts/import/all.sh <sources directory> [first year] [last year]
# The Tamil Bible is not part of this: its permission is pending.
set -euo pipefail

cd "$(dirname "$0")/../.."
SOURCES="${1:?sources directory required (scripts/import/fetch-sources.sh)}"
YEAR=$(date +%Y)
FROM="${2:-$((YEAR - 1))}"
TO="${3:-$((YEAR + 4))}"
[[ "$FROM" =~ ^20[0-9]{2}$ && "$TO" =~ ^20[0-9]{2}$ && "$FROM" -le "$TO" ]] || { echo "Invalid years: $FROM–$TO" >&2; exit 2; }
: "${DATABASE_URL:?DATABASE_URL is not set}"

scripts/import/fetch-sources.sh "$SOURCES"
pnpm -s import:bible --preset en-drc --path "$SOURCES/DRC.csv" --publish
pnpm -s import:prayers --path data/import/prayers/traditional-en.json --publish
pnpm -s import:rosary --path data/import/rosary/rosary.json --publish
pnpm -s import:lectionary --path "$SOURCES/lectionary-readings.sql"
pnpm -s calendar:generate --calendar in --from "$FROM" --to "$TO"
pnpm -s import:saints --path data/import/saints/saints.json --publish
echo "All content imported (calendar $FROM–$TO)."
