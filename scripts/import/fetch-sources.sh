#!/usr/bin/env bash
# Downloads the external source files the imports need, at pinned versions, and checks their SHA-256.
#   scripts/import/fetch-sources.sh <directory>
# Both sources are public domain (see docs/CONTENT_RIGHTS.md). Nothing is stored in this repository.
set -euo pipefail

DIR="${1:?target directory required}"
mkdir -p "$DIR"

fetch() { # url file sha256
  if [ ! -f "$DIR/$2" ] || ! echo "$3  $DIR/$2" | sha256sum --check --status; then
    curl -fsSL --retry 3 -o "$DIR/$2" "$1"
  fi
  echo "$3  $DIR/$2" | sha256sum --check --quiet
  echo "ok: $2"
}

# Douay-Rheims (scrollmapper/bible_databases)
fetch "https://raw.githubusercontent.com/scrollmapper/bible_databases/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/formats/csv/DRC.csv" \
  DRC.csv beedae44c6253903ffeac0987db858b0787c32ad3a70969debf1e98348d4b201
# Lectionary reading lists, references only (jayarathina/Tamil-Catholic-Lectionary)
fetch "https://raw.githubusercontent.com/jayarathina/Tamil-Catholic-Lectionary/c6c9d79d0f56721f6cc17fb8370d089f0dcd5fd2/MySQL/liturgy_lectionary_table_readings__list.sql" \
  lectionary-readings.sql 417615e7932efcb84722bbfcd7434b6fc2b56a649db9bd50139b1c5edcfc9601
