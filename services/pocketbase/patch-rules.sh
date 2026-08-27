#!/bin/sh
# Ensures PocketBase API rules enforce organization + org-role scoping.
# site_access join is deprecated (schema kept) — org membership + users.role govern access.
# Runs on every PocketBase startup.
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"

echo "Patch: updating collection API rules..."

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
  echo "Patch: could not authenticate, skipping rules patch."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

patch_collection() {
  col="$1"
  payload="$2"

  if ! collection_exists "$col"; then
    return
  fi

  if curl -sf -X PATCH "$PB_URL/api/collections/$col" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$payload" > /dev/null; then
    echo "  patched rules for $col"
  else
    echo "  note: could not patch rules for $col"
  fi
}

# Org-wide read for any member; write for org admin only.
ORG_WRITE='(@request.auth.role = \"admin\")'

ORGANIZATIONS='{
  "listRule": "@request.auth.id != \"\" && id = @request.auth.organization",
  "viewRule": "@request.auth.id != \"\" && id = @request.auth.organization",
  "createRule": "",
  "updateRule": "@request.auth.role = \"admin\" && id = @request.auth.organization",
  "deleteRule": ""
}'

SITES="{
  \"listRule\": \"organization = @request.auth.organization\",
  \"viewRule\": \"organization = @request.auth.organization\",
  \"createRule\": \"@request.auth.id != \\\"\\\" && organization = @request.auth.organization && ${ORG_WRITE}\",
  \"updateRule\": \"@request.auth.id != \\\"\\\" && organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"@request.auth.id != \\\"\\\" && organization = @request.auth.organization && ${ORG_WRITE}\"
}"

SCANS="{
  \"listRule\": \"site.organization = @request.auth.organization\",
  \"viewRule\": \"site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"site.organization = @request.auth.organization && ${ORG_WRITE}\"
}"

PAGES="{
  \"listRule\": \"site.organization = @request.auth.organization\",
  \"viewRule\": \"site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\"
}"

ISSUES="{
  \"listRule\": \"scan.site.organization = @request.auth.organization\",
  \"viewRule\": \"scan.site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"scan.site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"scan.site.organization = @request.auth.organization && ${ORG_WRITE}\"
}"

QA_BROKEN="{
  \"listRule\": \"scan.site.organization = @request.auth.organization\",
  \"viewRule\": \"scan.site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"scan.site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"\"
}"

QA_SPELLING="{
  \"listRule\": \"scan.site.organization = @request.auth.organization\",
  \"viewRule\": \"scan.site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"scan.site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"\"
}"

QA_INVENTORY="{
  \"listRule\": \"scan.site.organization = @request.auth.organization\",
  \"viewRule\": \"scan.site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\"
}"

QA_INVENTORY_REFS="{
  \"listRule\": \"scan.site.organization = @request.auth.organization\",
  \"viewRule\": \"scan.site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\"
}"

POLICIES="{
  \"listRule\": \"organization = @request.auth.organization\",
  \"viewRule\": \"organization = @request.auth.organization\",
  \"createRule\": \"organization = @request.auth.organization && ${ORG_WRITE} && (site = \\\"\\\" || site.organization = @request.auth.organization)\",
  \"updateRule\": \"organization = @request.auth.organization && ${ORG_WRITE} && (site = \\\"\\\" || site.organization = @request.auth.organization)\",
  \"deleteRule\": \"organization = @request.auth.organization && ${ORG_WRITE}\"
}"

POLICY_MATCHES="{
  \"listRule\": \"scan.site.organization = @request.auth.organization\",
  \"viewRule\": \"scan.site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"scan.site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"\"
}"

SCAN_QUEUE="{
  \"listRule\": \"site.organization = @request.auth.organization\",
  \"viewRule\": \"site.organization = @request.auth.organization\",
  \"createRule\": \"site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"updateRule\": \"site.organization = @request.auth.organization && ${ORG_WRITE}\",
  \"deleteRule\": \"site.organization = @request.auth.organization && ${ORG_WRITE}\"
}"

SCAN_LOG_EVENTS="{
  \"listRule\": \"site.organization = @request.auth.organization\",
  \"viewRule\": \"site.organization = @request.auth.organization\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\"
}"

# Deprecated: site_access is no longer used for authorization (kept for schema/data only).
SITE_ACCESS_RULES='{
  "listRule": "@request.auth.id != \"\" && (user = @request.auth.id || (@request.auth.role = \"admin\" && site.organization = @request.auth.organization))",
  "viewRule": "@request.auth.id != \"\" && (user = @request.auth.id || (@request.auth.role = \"admin\" && site.organization = @request.auth.organization))",
  "createRule": "@request.auth.role = \"admin\" && site.organization = @request.auth.organization",
  "updateRule": "@request.auth.role = \"admin\" && site.organization = @request.auth.organization",
  "deleteRule": "@request.auth.role = \"admin\" && site.organization = @request.auth.organization"
}'

patch_collection organizations "$ORGANIZATIONS"
patch_collection sites "$SITES"
patch_collection scans "$SCANS"
patch_collection pages "$PAGES"
patch_collection accessibility_issues "$ISSUES"
patch_collection qa_broken_links "$QA_BROKEN"
patch_collection qa_spelling "$QA_SPELLING"
patch_collection qa_inventory "$QA_INVENTORY"
patch_collection qa_inventory_refs "$QA_INVENTORY_REFS"
patch_collection policies "$POLICIES"
patch_collection policy_matches "$POLICY_MATCHES"
patch_collection scan_queue "$SCAN_QUEUE"
patch_collection scan_log_events "$SCAN_LOG_EVENTS"
patch_collection site_access "$SITE_ACCESS_RULES"

if collection_exists "scan_queue"; then
  curl -sf -X PATCH "$PB_URL/api/collections/scan_queue" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{
      "fields+": [{
        "name": "target_url",
        "type": "url"
      }]
    }' > /dev/null || true
  curl -sf -X PATCH "$PB_URL/api/collections/scan_queue" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{
      "fields+": [{
        "name": "raw_config",
        "type": "json"
      }]
    }' > /dev/null || true
fi

echo "Patch: collection rules updated."
