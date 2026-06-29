#!/bin/sh
# Ensures scan_log_events collection and scans log summary fields exist (live crawl log).
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
  echo "Patch scan-log-events: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

add_text_field() {
  col="$1"
  field="$2"
  max="${3:-0}"

  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  exists=$(echo "$body" | jq -e ".fields[] | select(.name == \"$field\")" > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  $col.$field already exists"
    return
  fi

  field_def="{\"name\": \"$field\", \"type\": \"text\", \"required\": false, \"presentable\": false, \"system\": false}"
  if [ "$max" -gt 0 ] 2>/dev/null; then
    field_def=$(echo "$field_def" | jq ". + {\"max\": $max}")
  fi

  updated_fields=$(echo "$body" | jq ".fields += [$field_def]")
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
  min="${3:-}"

  if ! collection_exists "$col"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  exists=$(echo "$body" | jq -e ".fields[] | select(.name == \"$field\")" > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  $col.$field already exists"
    return
  fi

  field_def="{\"name\": \"$field\", \"type\": \"number\", \"required\": false, \"presentable\": false, \"system\": false}"
  if [ -n "$min" ]; then
    field_def=$(echo "$field_def" | jq ". + {\"min\": $min}")
  fi

  updated_fields=$(echo "$body" | jq ".fields += [$field_def]")
  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added $col.$field"
  else
    echo "  note: could not add $col.$field"
  fi
}

ensure_scan_log_events() {
  if collection_exists scan_log_events; then
    echo "  scan_log_events already exists"
    return
  fi

  if ! collection_exists sites || ! collection_exists scans; then
    echo "  note: sites/scans missing — cannot create scan_log_events"
    return
  fi

  SITES_ID=$(curl -sf "$PB_URL/api/collections/sites" -H "$AUTH" | jq -r '.id')
  SCANS_ID=$(curl -sf "$PB_URL/api/collections/scans" -H "$AUTH" | jq -r '.id')

  if [ -z "$SITES_ID" ] || [ -z "$SCANS_ID" ]; then
    echo "  note: could not resolve sites/scans collection ids"
    return
  fi

  if curl -sf -X POST "$PB_URL/api/collections" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{
      \"name\": \"scan_log_events\",
      \"type\": \"base\",
      \"listRule\": \"@request.auth.id != \\\"\\\"\",
      \"viewRule\": \"@request.auth.id != \\\"\\\"\",
      \"createRule\": \"\",
      \"updateRule\": \"\",
      \"deleteRule\": \"\",
      \"fields\": [
        {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
        {\"name\": \"site\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SITES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
        {\"name\": \"level\", \"type\": \"select\", \"required\": true, \"values\": [\"info\", \"success\", \"warn\", \"error\"], \"maxSelect\": 1},
        {\"name\": \"message\", \"type\": \"text\", \"required\": true, \"max\": 2000},
        {\"name\": \"url\", \"type\": \"url\"}
      ]
    }" > /dev/null; then
    echo "  created scan_log_events"
  else
    echo "  note: could not create scan_log_events"
  fi
}

echo "Patch: scan log events..."
add_text_field scans error_message 500
add_number_field scans open_issue_count 0
ensure_scan_log_events
echo "Patch: scan log events done."
