#!/usr/bin/env bash
# Creates (or recreates) a local database with a Supabase stand-in, all migrations and the seed.
#   scripts/db/setup-local.sh <database>
# Connection: standard libpq variables (PGHOST, PGPORT, PGUSER).
set -euo pipefail

cd "$(dirname "$0")/../.."
DB="${1:?database name required}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -o /dev/null)

dropdb --if-exists "$DB"
createdb "$DB"
# Same default search_path as Supabase.
"${PSQL[@]}" -d postgres -c "alter database \"$DB\" set search_path = \"\$user\", public, extensions"

"${PSQL[@]}" -d "$DB" -f supabase/tests/support/supabase_shim.sql
for migration in supabase/migrations/*.sql; do
  echo "migrate: $migration"
  "${PSQL[@]}" -d "$DB" -f "$migration"
done
echo "seed: supabase/seed.sql"
"${PSQL[@]}" -d "$DB" -f supabase/seed.sql
