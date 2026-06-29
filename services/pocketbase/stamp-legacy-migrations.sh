#!/bin/sh
# Older installs created schema via bootstrap.sh + patch-*.sh, not pb_migrations.
# When numbered migrations were added to the image, PocketBase tries to re-create
# collections that already exist. Stamp pre-multi-tenant migrations as applied so
# only new migrations (e.g. 1730000020_multi_tenant.js) run on upgrade.
set -e

DB="/pb/pb_data/data.db"
MARKER="/pb/pb_data/.bootstrapped"
STAMPED="/pb/pb_data/.repo_migrations_stamped"
MIGRATIONS_DIR="/pb/pb_migrations"
MULTI_TENANT_CUTOFF=1730000020

[ -f "$DB" ] || exit 0
[ -f "$MARKER" ] || exit 0
[ -f "$STAMPED" ] && exit 0

if sqlite3 "$DB" "SELECT 1 FROM _migrations WHERE file='1730000001_sites.js' LIMIT 1;" | grep -q 1; then
  touch "$STAMPED"
  exit 0
fi

echo "Stamping legacy bootstrap migrations as applied (skipping <$MULTI_TENANT_CUTOFF)..."
NOW=$(date +%s)000

for f in "$MIGRATIONS_DIR"/*.js; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  num=${base%%_*}
  case "$num" in
    ''|*[!0-9]*) continue ;;
  esac
  if [ "$num" -ge "$MULTI_TENANT_CUTOFF" ]; then
    continue
  fi
  sqlite3 "$DB" "INSERT OR IGNORE INTO _migrations (file, applied) VALUES ('$base', $NOW);"
done

touch "$STAMPED"
echo "Legacy migrations stamped."
