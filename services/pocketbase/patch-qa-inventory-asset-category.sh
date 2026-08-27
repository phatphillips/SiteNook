#!/bin/sh
# Adds qa_inventory.asset_category select field for fast inventory tab queries.
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
  echo "Patch qa-inventory-asset-category: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

add_select_field() {
  col="$1"
  field="$2"
  values="$3"
  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -s "$PB_URL/api/collections/$col" -H "$AUTH")
  if echo "$body" | grep -q "\"name\":\"$field\""; then
    echo "Patch qa-inventory-asset-category: $col.$field already exists."
    return
  fi

  patch=$(echo "$body" | jq --arg name "$field" --argjson values "$values" \
    '.fields += [{"name": $name, "type": "select", "values": $values, "maxSelect": 1}]')

  code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$PB_URL/api/collections/$col" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "$patch")

  if [ "$code" = "200" ]; then
    echo "Patch qa-inventory-asset-category: added $col.$field"
  else
    echo "Patch qa-inventory-asset-category: failed to add $col.$field (HTTP $code)"
  fi
}

add_select_field "qa_inventory" "asset_category" '["image","file","pdf"]'

echo "Patch qa-inventory-asset-category: done."
