#!/bin/sh
# Idempotent users collection fixes (runs every boot).
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
  echo "Patch: could not authenticate as superuser, skipping."
  exit 0
fi

AUTH="Authorization: $TOKEN"

echo "Patch: updating users collection settings..."
curl -sf -X PATCH "$PB_URL/api/collections/users" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "createRule": "",
    "listRule": "",
    "viewRule": "",
    "authAlert": { "enabled": false },
    "fields+": [{
      "name": "role",
      "type": "select",
      "values": ["admin", "analyst", "viewer"],
      "maxSelect": 1
    }]
  }' > /dev/null || echo "  note: users patch may partially apply"

echo "Patch: disabled login alert and ensured role field."

if [ -n "$APP_USER_EMAIL" ] && [ -n "$APP_USER_PASSWORD" ]; then
  EXISTING=$(curl -sf "$PB_URL/api/collections/users/records?filter=(email='$APP_USER_EMAIL')" \
    -H "$AUTH")
  USER_ID=$(echo "$EXISTING" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)

  if [ -n "$USER_ID" ]; then
    curl -sf -X PATCH "$PB_URL/api/collections/users/records/$USER_ID" \
      -H "Content-Type: application/json" \
      -H "$AUTH" \
      -d "{
        \"verified\": true,
        \"password\": \"$APP_USER_PASSWORD\",
        \"passwordConfirm\": \"$APP_USER_PASSWORD\"
      }" > /dev/null || true
    echo "Patch: synced app user password and verified=true for $APP_USER_EMAIL"
  fi
fi

echo "Patch complete."
