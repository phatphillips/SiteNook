#!/bin/sh
# Adds pages.rendered_html file field for Content Explorer freeze-frames.
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
  echo "Patch pages-rendered-html: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

if ! curl -sf "$PB_URL/api/collections/pages" -H "$AUTH" > /dev/null; then
  echo "Patch pages-rendered-html: pages collection missing, skipping."
  exit 0
fi

body=$(curl -sf "$PB_URL/api/collections/pages" -H "$AUTH")
exists=$(echo "$body" | jq -e '.fields[] | select(.name == "rendered_html")' > /dev/null 2>&1 && echo yes || echo "")
if [ -n "$exists" ]; then
  echo "  pages.rendered_html already exists"
  exit 0
fi

updated_fields=$(echo "$body" | jq '.fields += [{
  "name": "rendered_html",
  "type": "file",
  "required": false,
  "presentable": false,
  "system": false,
  "maxSelect": 1,
  "maxSize": 8388608,
  "mimeTypes": ["text/html"],
  "thumbs": [],
  "protected": false
}]')

if curl -sf -X PATCH "$PB_URL/api/collections/pages" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "$updated_fields" > /dev/null; then
  echo "  added pages.rendered_html"
else
  echo "  note: could not add pages.rendered_html"
fi
