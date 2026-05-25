#!/bin/sh
# Ensures PocketBase API rules allow authenticated app users to read/write
# and enqueue scans. Runs on every PocketBase startup.
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"

echo "Patch: updating collection API rules..."

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
  echo "Patch: could not authenticate, skipping rules patch."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

patch_collection() {
  col="$1"
  payload="$2"

  if ! collection_exists "$col"; then
    return
  fi

  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$payload" > /dev/null; then
    echo "  patched rules for $col"
  else
    echo "  note: could not patch rules for $col"
  fi
}

AUTH_ONLY='{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\""
}'

READ_ONLY='{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "",
  "updateRule": "",
  "deleteRule": ""
}'

READ_UPDATE='{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\""
}'

READ_UPDATE_NO_DELETE='{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": ""
}'

SCAN_QUEUE='{
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "",
  "deleteRule": ""
}'

patch_collection sites "$AUTH_ONLY"
patch_collection scans "$READ_ONLY"
patch_collection pages "$READ_ONLY"
patch_collection accessibility_issues "$READ_UPDATE"
patch_collection qa_broken_links "$READ_UPDATE_NO_DELETE"
patch_collection qa_spelling "$READ_UPDATE_NO_DELETE"
patch_collection qa_inventory "$READ_ONLY"
patch_collection policies "$AUTH_ONLY"
patch_collection policy_matches "$READ_UPDATE_NO_DELETE"
patch_collection scan_queue "$SCAN_QUEUE"

if collection_exists "scan_queue"; then
  curl -sf -X PATCH "$PB_URL/api/collections/scan_queue" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{
      "fields+": [{
        "name": "target_url",
        "type": "url"
      }]
    }' > /dev/null || true
fi

echo "Patch: collection rules updated."
