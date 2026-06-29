#!/bin/sh
# Adds sites.score_denominators and scans.score_denominators JSON fields.
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
  echo "Patch score-denominators: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

add_json_field() {
  col="$1"
  field="$2"
  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  exists=$(echo "$body" | jq -e ".fields[] | select(.name == \"$field\")" > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  $col.$field already exists"
    return
  fi

  updated_fields=$(echo "$body" | jq ".fields += [{\"name\": \"$field\", \"type\": \"json\", \"required\": false, \"presentable\": false, \"system\": false}]")
  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added $col.$field"
  else
    echo "  note: could not add $col.$field"
  fi
}

add_number_field() {
  col="$1"
  field="$2"
  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  exists=$(echo "$body" | jq -e ".fields[] | select(.name == \"$field\")" > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  $col.$field already exists"
    return
  fi

  updated_fields=$(echo "$body" | jq ".fields += [{\"name\": \"$field\", \"type\": \"number\", \"required\": false, \"presentable\": false, \"system\": false, \"min\": 0, \"max\": 100}]")
  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added $col.$field"
  else
    echo "  note: could not add $col.$field"
  fi
}

echo "Patch: score_denominators fields..."
add_json_field sites score_denominators
add_json_field scans score_denominators
add_number_field scans score_overall
add_number_field scans score_best_practices
echo "Patch: score_denominators done."
