#!/usr/bin/env bash
# Local dev on the box: start Postgres (if needed) + the app on port 3000.
set -e
B=/usr/lib/postgresql/17/bin
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  mkdir -p /tmp/pgsock
  $B/pg_ctl -D /workspace/pgdata -o "-p 5432 -k /tmp/pgsock -c listen_addresses=localhost" -l /workspace/pgdata.log start
fi
cd "$(dirname "$0")/.."
pkill -f 'node src/server.js' || true
DATABASE_URL=${DATABASE_URL:-postgres://box@localhost:5432/japanhiu} ADMIN_PASSWORD=${ADMIN_PASSWORD:-devpass-123} PORT=${PORT:-3000} \
  nohup node src/server.js >> /tmp/jh.log 2>&1 &
echo "started; log: /tmp/jh.log"
