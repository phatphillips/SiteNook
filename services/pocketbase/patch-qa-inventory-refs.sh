#!/bin/sh
# Adds qa_inventory_refs collection and qa_inventory.found_on_page_count for asset source pages.
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"

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
  echo "Patch qa-inventory-refs: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

add_number_field() {
  col="$1"
  field="$2"
  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -s "$PB_URL/api/collections/$col" -H "$AUTH")
  if echo "$body" | grep -q "\"name\":\"$field\""; then
    echo "Patch qa-inventory-refs: $col.$field already exists."
    return
  fi

  patch=$(echo "$body" | jq --arg name "$field" \
    '.fields += [{"name": $name, "type": "number", "min": 0}]')

  code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$PB_URL/api/collections/$col" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "$patch")

  if [ "$code" = "200" ]; then
    echo "Patch qa-inventory-refs: added $col.$field"
  else
    echo "Patch qa-inventory-refs: failed to add $col.$field (HTTP $code)"
  fi
}

if ! collection_exists "qa_inventory_refs"; then
  echo "Patch qa-inventory-refs: qa_inventory_refs collection missing — apply migration 1730000045."
fi

add_number_field "qa_inventory" "found_on_page_count"

echo "Patch qa-inventory-refs: done."
