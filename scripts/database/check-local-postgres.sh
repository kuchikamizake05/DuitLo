#!/usr/bin/env bash
set -euo pipefail
# Uses an existing PostgreSQL installation, never the machine's existing cluster.
task_pg_bin="${FINTRACK_PG_BIN:-/usr/lib/postgresql/16/bin}"
task_pg_dir="$(mktemp -d /tmp/fintrack-pg-hardening.XXXXXX)"
export PGHOST="$task_pg_dir" PGPORT=55439 PGUSER="$(id -un)" PGDATABASE=fintrack_test
export FINTRACK_DISPOSABLE_DATABASE=YES
task_started=0
cleanup() {
  if [[ "$task_started" = 1 ]]; then "$task_pg_bin/pg_ctl" -D "$task_pg_dir/data" -m fast -w stop; fi
  printf 'Disposable cluster evidence retained at %s\n' "$task_pg_dir"
}
trap cleanup EXIT
"$task_pg_bin/initdb" -D "$task_pg_dir/data" -A trust --no-locale -E UTF8 > "$task_pg_dir/init.log"
"$task_pg_bin/pg_ctl" -D "$task_pg_dir/data" -l "$task_pg_dir/server.log" -o "-k $task_pg_dir -p $PGPORT -c listen_addresses= -c shared_buffers=32MB -c max_connections=10" -w start
task_started=1
"$task_pg_bin/createdb" "$PGDATABASE"
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/financial-journey.sql
node scripts/database/run-disposable.mjs
