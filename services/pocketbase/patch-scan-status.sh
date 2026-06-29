#!/bin/sh
# Ensures scan_queue/scans schema supports cancel + persisted scan configuration.
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
  echo "Patch scan-status: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

add_cancelled_status() {
  col="$1"
  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  has_cancelled=$(echo "$body" | jq -r '.fields[] | select(.name == "status") | .values[]?' 2>/dev/null | grep -Fx 'cancelled' || true)
  if [ -n "$has_cancelled" ]; then
    echo "  $col.status already includes cancelled"
    return
  fi

  updated_fields=$(echo "$body" | jq '
    .fields |= map(
      if .name == "status" then
        .values = ((.values // []) + ["cancelled"] | unique)
      else . end
    )
  ')

  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added cancelled to $col.status"
  else
    echo "  note: could not patch $col.status values"
  fi
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
    verify=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH" | jq -e ".fields[] | select(.name == \"$field\")" > /dev/null 2>&1 && echo yes || echo "")
    if [ -n "$verify" ]; then
      echo "  added $col.$field"
    else
      echo "  note: PATCH succeeded but $col.$field is still missing"
    fi
  else
    echo "  note: could not add $col.$field"
  fi
}

echo "Patch: scan schema..."
add_json_field scan_queue raw_config
add_json_field scans raw_config
add_json_field sites default_scan_config
add_cancelled_status scan_queue
add_cancelled_status scans

add_scan_status_value() {
  col="$1"
  value="$2"
  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  has_value=$(echo "$body" | jq -r --arg v "$value" '.fields[] | select(.name == "status") | .values[]?' 2>/dev/null | grep -Fx "$value" || true)
  if [ -n "$has_value" ]; then
    echo "  $col.status already includes $value"
    return
  fi

  updated_fields=$(echo "$body" | jq --arg v "$value" '
    .fields |= map(
      if .name == "status" then
        .values = ((.values // []) + [$v] | unique)
      else . end
    )
  ')

  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added $value to $col.status"
  else
    echo "  note: could not patch $col.status ($value)"
  fi
}

add_scan_status_value scans background_scan
add_scan_status_value scans complete_with_errors
add_json_field scans unscanned_urls
add_json_field scans background_retry
echo "Patch: scan schema done."
