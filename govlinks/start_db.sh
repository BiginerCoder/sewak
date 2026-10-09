#!/usr/bin/env bash
# Start (or create) a throwaway PostgreSQL on port 5433. Data lives in /tmp/pgdata_govlinks and is disposable.
set -e
D=${PGDATA_DIR:-/tmp/pgdata_govlinks}
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
if [ ! -f "$D/PG_VERSION" ]; then
  mkdir -p "$D"; chown postgres:postgres "$D"
  runuser -u postgres -- $BIN/initdb -D "$D" -A trust >/dev/null
fi
if ! runuser -u postgres -- $BIN/pg_ctl -D "$D" status >/dev/null 2>&1; then
  rm -f "$D/postmaster.pid"
  runuser -u postgres -- $BIN/pg_ctl -D "$D" -o "-p 5433 -k /tmp" -l "$D/log" -w start >/dev/null
fi
echo "PostgreSQL ready on port 5433 (socket /tmp)"
