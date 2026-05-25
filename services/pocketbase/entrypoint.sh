#!/bin/sh
set -e

mkdir -p /pb/pb_data

# First boot: initialise data store and superuser before serving
if [ ! -f /pb/pb_data/data.db ]; then
  echo "First run — initializing PocketBase data store..."
  /pb/pocketbase serve --dir=/pb/pb_data --http=127.0.0.1:8090 &
  INIT_PID=$!

  i=0
  while [ "$i" -lt 30 ]; do
    if wget -q --spider http://127.0.0.1:8090/api/health 2>/dev/null; then
      break
    fi
    i=$((i + 1))
    sleep 1
  done

  if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
    /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb/pb_data || true
  fi

  kill "$INIT_PID" 2>/dev/null || true
  wait "$INIT_PID" 2>/dev/null || true
  sleep 1
elif [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb/pb_data || true
fi

echo "Starting PocketBase..."
/pb/pocketbase serve --dir=/pb/pb_data --http=0.0.0.0:8090 &
PB_PID=$!

until wget -q --spider http://127.0.0.1:8090/api/health 2>/dev/null; do sleep 1; done

if [ ! -f /pb/pb_data/.bootstrapped ]; then
  /pb/bootstrap.sh && touch /pb/pb_data/.bootstrapped
fi

if [ ! -f /pb/pb_data/.seeded ]; then
  /pb/seed.sh && touch /pb/pb_data/.seeded
fi

/pb/patch-users.sh || true
/pb/patch-rules.sh || true

wait "$PB_PID"
