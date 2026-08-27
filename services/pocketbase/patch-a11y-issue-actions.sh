#!/bin/sh
# Ensures accessibility_issue_actions exists (issue dismiss/fix/reopen history).
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
  echo "Patch a11y-issue-actions: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

if collection_exists "accessibility_issue_actions"; then
  echo "Patch a11y-issue-actions: accessibility_issue_actions already exists."
  exit 0
fi

if ! collection_exists "organizations" || ! collection_exists "sites" || ! collection_exists "users"; then
  echo "Patch a11y-issue-actions: required collections missing, skipping."
  exit 0
fi

org_id=$(curl -sf "$PB_URL/api/collections/organizations" -H "$AUTH" | jq -r '.id')
sites_id=$(curl -sf "$PB_URL/api/collections/sites" -H "$AUTH" | jq -r '.id')
users_id=$(curl -sf "$PB_URL/api/collections/users" -H "$AUTH" | jq -r '.id')

payload=$(jq -n \
  --arg org_id "$org_id" \
  --arg sites_id "$sites_id" \
  --arg users_id "$users_id" \
  '{
    "name": "accessibility_issue_actions",
    "type": "base",
    "listRule": "organization = @request.auth.organization",
    "viewRule": "organization = @request.auth.organization",
    "createRule": "@request.auth.id != \"\" && organization = @request.auth.organization",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "name": "organization",
        "type": "relation",
        "required": true,
        "collectionId": $org_id,
        "maxSelect": 1,
        "cascadeDelete": true
      },
      {
        "name": "site",
        "type": "relation",
        "required": true,
        "collectionId": $sites_id,
        "maxSelect": 1,
        "cascadeDelete": true
      },
      {
        "name": "actor",
        "type": "relation",
        "required": false,
        "collectionId": $users_id,
        "maxSelect": 1,
        "cascadeDelete": false
      },
      {
        "name": "action",
        "type": "select",
        "required": true,
        "maxSelect": 1,
        "values": ["dismissed", "fixed", "reopened"]
      },
      {
        "name": "scope",
        "type": "select",
        "required": true,
        "maxSelect": 1,
        "values": ["rule", "page"]
      },
      { "name": "rule_id", "type": "text", "required": true },
      { "name": "description", "type": "text" },
      {
        "name": "impact",
        "type": "select",
        "values": ["critical", "serious", "moderate", "minor"],
        "maxSelect": 1
      },
      {
        "name": "wcag_level",
        "type": "select",
        "values": ["A", "AA", "AAA"],
        "maxSelect": 1
      },
      { "name": "page_url", "type": "text" },
      { "name": "page_title", "type": "text" },
      { "name": "dismiss_reason", "type": "text" },
      { "name": "issue_ids", "type": "json" },
      { "name": "logged_at", "type": "date", "required": true }
    ],
    "indexes": [
      "CREATE INDEX idx_a11y_issue_actions_site_logged ON accessibility_issue_actions (site, logged_at)",
      "CREATE INDEX idx_a11y_issue_actions_org_logged ON accessibility_issue_actions (organization, logged_at)"
    ]
  }')

code=$(curl -s -o /tmp/a11y_issue_actions_create.json -w "%{http_code}" -X POST "$PB_URL/api/collections" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "$payload")

if [ "$code" = "200" ] || [ "$code" = "201" ]; then
  echo "Patch a11y-issue-actions: created accessibility_issue_actions collection."
else
  echo "Patch a11y-issue-actions: failed to create collection (HTTP $code)"
  cat /tmp/a11y_issue_actions_create.json 2>/dev/null || true
fi
