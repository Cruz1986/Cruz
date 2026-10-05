#!/usr/bin/env bash
# Builds a throwaway database from the migrations + seed and runs the pgTAP suite.
#
# Requires a local PostgreSQL 15+ with the pgTAP extension and pg_prove.
# With the Supabase CLI and Docker you can instead run: supabase db reset && supabase test db
#
# Connection: standard libpq variables (PGHOST, PGPORT, PGUSER). Database name: $TEST_DB.
set -euo pipefail

cd "$(dirname "$0")/../.."
TEST_DB="${TEST_DB:-app_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -o /dev/null)

dropdb --if-exists "$TEST_DB"
createdb "$TEST_DB"
# Same default search_path as Supabase.
"${PSQL[@]}" -d postgres -c "alter database \"$TEST_DB\" set search_path = \"\$user\", public, extensions"

"${PSQL[@]}" -d "$TEST_DB" -f supabase/tests/support/supabase_shim.sql
for migration in supabase/migrations/*.sql; do
  echo "migrate: $migration"
  "${PSQL[@]}" -d "$TEST_DB" -f "$migration"
done
echo "seed: supabase/seed.sql"
"${PSQL[@]}" -d "$TEST_DB" -f supabase/seed.sql
# Seed must be idempotent.
"${PSQL[@]}" -d "$TEST_DB" -f supabase/seed.sql

"${PSQL[@]}" -d "$TEST_DB" -c "create extension if not exists pgtap with schema extensions"
pg_prove -d "$TEST_DB" --ext .sql supabase/tests/database/
