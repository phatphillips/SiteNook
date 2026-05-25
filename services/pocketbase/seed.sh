#!/bin/sh
# Creates the default app user (runs once after bootstrap).
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"

echo "Seed: waiting for PocketBase..."
until wget -q --spider "$PB_URL/api/health" 2>/dev/null; do sleep 1; done

if [ -z "$APP_USER_EMAIL" ] || [ -z "$APP_USER_PASSWORD" ]; then
  echo "Seed: APP_USER_EMAIL / APP_USER_PASSWORD not set, skipping."
  exit 0
fi

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
  echo "ERROR: Could not authenticate as superuser. Check PB_ADMIN_EMAIL/PASSWORD."
  exit 1
fi
echo "Got admin token."

EXISTING=$(curl -sf "$PB_URL/api/collections/users/records?filter=(email='$APP_USER_EMAIL')" \
  -H "Authorization: $TOKEN")

if echo "$EXISTING" | grep -q '"totalItems":[1-9]'; then
  USER_ID=$(echo "$EXISTING" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  if [ -n "$USER_ID" ]; then
    curl -sf -X PATCH "$PB_URL/api/collections/users/records/$USER_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: $TOKEN" \
      -d '{"verified":true}' > /dev/null || true
  fi
  echo "Seed: app user already exists, ensured verified=true."
  exit 0
fi

curl -sf -X POST "$PB_URL/api/collections/users/records" \
  -H "Content-Type: application/json" \
  -H "Authorization: $TOKEN" \
  -d "{
    \"email\": \"$APP_USER_EMAIL\",
    \"password\": \"$APP_USER_PASSWORD\",
    \"passwordConfirm\": \"$APP_USER_PASSWORD\",
    \"name\": \"Admin\",
    \"role\": \"admin\",
    \"emailVisibility\": true,
    \"verified\": true
  }" > /dev/null

echo "Seed complete: created app user $APP_USER_EMAIL"
