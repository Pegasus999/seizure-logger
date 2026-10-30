#!/usr/bin/env bash
# Runs the Supabase migration + RLS tests against a throwaway local Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
if [ ! -x "$PG_BIN/initdb" ]; then
  if command -v pg_config >/dev/null 2>&1; then PG_BIN="$(pg_config --bindir)"; fi
fi
[ -x "$PG_BIN/initdb" ] || { echo "initdb not found (set PG_BIN)" >&2; exit 1; }

PORT=54329
TMP="$(mktemp -d "${TMPDIR:-/tmp}/rls-test.XXXXXX")"
DATA="$TMP/data"
RUN_AS=()

if [ "$(id -u)" = "0" ]; then
  if id postgres >/dev/null 2>&1; then
    PGUSER_NAME=postgres
  else
    PGUSER_NAME=rlstest
    id "$PGUSER_NAME" >/dev/null 2>&1 || useradd -M -s /bin/bash "$PGUSER_NAME"
  fi
  chmod 755 "$TMP"
  mkdir -p "$DATA"
  chown "$PGUSER_NAME" "$TMP" "$DATA"
  # sql files must be readable by the postgres user (psql runs as it)
  RUN_AS=(runuser -u "$PGUSER_NAME" --)
fi
PSQL_USER="${PGUSER_NAME:-$(id -un)}"

cleanup() {
  "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DATA" -U "$PSQL_USER" --auth=trust -E UTF8 >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -w -l "$TMP/pg.log" \
  -o "-p $PORT -k $TMP -c listen_addresses=''" start >/dev/null

PSQL=("${RUN_AS[@]}" psql -X -q -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U "$PSQL_USER")
"${PSQL[@]}" -d postgres -c "create database rls_test" 
"${PSQL[@]}" -d rls_test -f "$ROOT/supabase/tests/auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${PSQL[@]}" -d rls_test -f "$f"
done
"${PSQL[@]}" -d rls_test -f "$ROOT/supabase/tests/rls_test.sql"
