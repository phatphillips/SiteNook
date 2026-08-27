#!/bin/sh
# Adds pages.html_size_bytes and backfills from stored html_snapshot length.
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
  echo "Patch pages-html-size: could not authenticate, skipping."
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

  body=$(curl -sf "$PB_URL/api/collections/$col" -H "$AUTH")
  exists=$(echo "$body" | jq -e ".fields[] | select(.name == \"$field\")" > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  $col.$field already exists"
    return
  fi

  updated_fields=$(echo "$body" | jq ".fields += [{\"name\": \"$field\", \"type\": \"number\", \"required\": false, \"presentable\": false, \"system\": false, \"min\": 0}]")
  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added $col.$field"
  else
    echo "  note: could not add $col.$field"
  fi
}

backfill_pages_html_size() {
  if ! collection_exists pages; then
    return
  fi

  page=1
  per_page=50
  updated=0
  while :; do
    resp=$(curl -sf "$PB_URL/api/collections/pages/records?page=$page&perPage=$per_page&filter=html_snapshot%20!%3D%20%22%22&fields=id,html_snapshot,html_size_bytes" -H "$AUTH" || echo "")
    if [ -z "$resp" ]; then
      break
    fi

    total_pages=$(echo "$resp" | jq -r '.totalPages // 0')
    items=$(echo "$resp" | jq -c '.items[]?')
    if [ -z "$items" ]; then
      break
    fi

    echo "$items" | while IFS= read -r record; do
      id=$(echo "$record" | jq -r '.id')
      existing=$(echo "$record" | jq -r '.html_size_bytes // 0')
      if [ "$existing" != "0" ] && [ "$existing" != "null" ]; then
        continue
      fi

      size=$(echo "$record" | jq -r '.html_snapshot // ""' | wc -c | tr -d ' ')
      if [ -z "$size" ] || [ "$size" -le 0 ]; then
        continue
      fi

      if curl -sf -X PATCH "$PB_URL/api/collections/pages/records/$id" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "{\"html_size_bytes\": $size}" > /dev/null; then
        updated=$((updated + 1))
      fi
    done

    if [ "$page" -ge "$total_pages" ]; then
      break
    fi
    page=$((page + 1))
  done

  echo "  backfilled html_size_bytes on pages (batch pages processed: $page)"
}

echo "Patch: pages html_size_bytes..."
add_number_field pages html_size_bytes
backfill_pages_html_size
echo "Patch: pages html_size_bytes done."
