#!/bin/sh
# Idempotent PocketBase app settings (runs every boot).
# - Brand emails as SiteNook (default PocketBase meta.appName is "Acme")
# - Trust nginx X-Forwarded-For / X-Real-IP so auth-origin fingerprints use the
#   real client IP instead of the nginx container IP (which changes on restart)
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
APP_NAME="${APP_NAME:-SiteNook}"
# Prefer the dashboard URL already wired for password-reset templates.
APP_URL="${APP_DASHBOARD_URL:-${NUXT_PUBLIC_APP_URL:-${APP_URL:-http://localhost}}}"

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
  echo "Patch app-settings: could not authenticate as superuser, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

current=$(curl -sf "$PB_URL/api/settings" -H "$AUTH") || {
  echo "Patch app-settings: could not load settings, skipping."
  exit 0
}

payload=$(echo "$current" | jq \
  --arg appName "$APP_NAME" \
  --arg appURL "$APP_URL" \
  --arg senderName "$APP_NAME" \
  '
  .meta.appName = $appName
  | .meta.appURL = $appURL
  | (if (.meta.senderName == "" or .meta.senderName == "Support" or .meta.senderName == "Acme")
      then .meta.senderName = $senderName else . end)
  | .trustedProxy.headers = ["X-Forwarded-For", "X-Real-IP"]
  | .trustedProxy.useLeftmostIP = false
  | { meta, trustedProxy }
  ')

if curl -sf -X PATCH "$PB_URL/api/settings" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "$payload" > /dev/null; then
  echo "Patch app-settings: appName=$APP_NAME, trustedProxy headers set."
else
  echo "Patch app-settings: note: settings patch failed."
fi
