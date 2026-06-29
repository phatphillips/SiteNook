#!/bin/sh
# Idempotent multi-tenant backfill (runs every boot after migrations).
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
DEFAULT_ORG_NAME="${DEFAULT_ORG_NAME:-Default Organization}"
DEFAULT_ORG_SUBDOMAIN="${DEFAULT_ORG_SUBDOMAIN:-default}"

get_token() {
  TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

  if [ -z "$TOKEN" ]; then
    TOKEN=$(curl -s -X POST "$PB_URL/api/admins/auth-with-password" \
      -H "Content-Type: application/json" \
      -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
      | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  fi

  echo "$TOKEN"
}

TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
  echo "Patch multi-tenant: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

if ! collection_exists "organizations"; then
  echo "Patch multi-tenant: organizations collection missing (migration not applied yet), skipping."
  exit 0
fi

echo "Patch multi-tenant: ensuring default organization and backfill..."

ORG_LIST=$(curl -sf "$PB_URL/api/collections/organizations/records?filter=(subdomain='$DEFAULT_ORG_SUBDOMAIN')&perPage=1" -H "$AUTH" || echo '{"items":[]}')
ORG_ID=$(echo "$ORG_LIST" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)

if [ -z "$ORG_ID" ]; then
  ORG_RESP=$(curl -sf -X POST "$PB_URL/api/collections/organizations/records" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{\"name\":\"$DEFAULT_ORG_NAME\",\"subdomain\":\"$DEFAULT_ORG_SUBDOMAIN\",\"plan\":\"standard\",\"status\":\"active\",\"subscription_status\":\"none\"}")
  ORG_ID=$(echo "$ORG_RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  echo "  created default organization ($DEFAULT_ORG_SUBDOMAIN)"
fi

if [ -z "$ORG_ID" ]; then
  echo "Patch multi-tenant: could not resolve default organization id, skipping backfill."
  exit 0
fi

patch_records_missing_field() {
  collection="$1"
  field="$2"
  value="$3"

  page=1
  while true; do
    RESP=$(curl -sf "$PB_URL/api/collections/$collection/records?filter=($field='')&perPage=100&page=$page" -H "$AUTH" || echo '{"items":[]}')
    COUNT=$(echo "$RESP" | sed -n 's/.*"items":\[\(.*\)\].*/\1/p' | grep -o '"id"' | wc -l | tr -d ' ')
    if [ "$COUNT" = "0" ] || ! echo "$RESP" | grep -q '"id"'; then
      break
    fi

    echo "$RESP" | sed 's/},{"id"/}\n{"id"/g' | while IFS= read -r item; do
      RECORD_ID=$(echo "$item" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
      [ -z "$RECORD_ID" ] && continue
      curl -sf -X PATCH "$PB_URL/api/collections/$collection/records/$RECORD_ID" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "{\"$field\":\"$value\"}" > /dev/null || true
    done

    page=$((page + 1))
    if [ "$page" -gt 20 ]; then
      break
    fi
  done
}

patch_records_missing_field "users" "organization" "$ORG_ID"
patch_records_missing_field "sites" "organization" "$ORG_ID"

if collection_exists "site_access"; then
  SITES=$(curl -sf "$PB_URL/api/collections/sites/records?perPage=500&fields=id,owner" -H "$AUTH" || echo '{"items":[]}')
  ADMINS=$(curl -sf "$PB_URL/api/collections/users/records?filter=(role='admin')&perPage=500&fields=id" -H "$AUTH" || echo '{"items":[]}')
  ADMIN_IDS=$(echo "$ADMINS" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

  echo "$SITES" | sed 's/},{"id"/}\n{"id"/g' | while IFS= read -r site_item; do
    SITE_ID=$(echo "$site_item" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
    OWNER_ID=$(echo "$site_item" | sed -n 's/.*"owner":"\([^"]*\)".*/\1/p' | head -1)
    [ -z "$SITE_ID" ] && continue

    for USER_ID in $OWNER_ID $ADMIN_IDS; do
      [ -z "$USER_ID" ] && continue
      EXISTS=$(curl -sf "$PB_URL/api/collections/site_access/records?filter=(user='$USER_ID'&&site='$SITE_ID')&perPage=1" -H "$AUTH" || echo '{"totalItems":0}')
      if echo "$EXISTS" | grep -q '"totalItems":0'; then
        curl -sf -X POST "$PB_URL/api/collections/site_access/records" \
          -H "Content-Type: application/json" \
          -H "$AUTH" \
          -d "{\"user\":\"$USER_ID\",\"site\":\"$SITE_ID\",\"role\":\"owner\"}" > /dev/null || true
      fi
    done
  done
fi

echo "Patch multi-tenant: backfill complete."
