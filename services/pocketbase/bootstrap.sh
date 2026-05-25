#!/bin/sh
# Creates AccessIQ collections via PocketBase Admin REST API (runs once).
set -e

PB_URL="${PB_URL:-http://127.0.0.1:8090}"

echo "Bootstrap: waiting for PocketBase..."
until wget -q --spider "$PB_URL/api/health" 2>/dev/null; do sleep 1; done

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

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

extract_id() {
  echo "$1" | sed -n 's/^{"id":"\([^"]*\)".*/\1/p'
}

create_collection() {
  curl -sf -X POST "$PB_URL/api/collections" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$1"
}

USERS_ID="_pb_users_auth_"
echo "  users collection ($USERS_ID)"

# Allow public signup + add role field on users
curl -sf -X PATCH "$PB_URL/api/collections/users" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{
    "createRule": "",
    "listRule": "",
    "viewRule": "",
    "options": {
      "requireEmail": true,
      "exceptEmailDomains": [],
      "allowEmailAuth": true,
      "allowUsernameAuth": false,
      "minPasswordLength": 8
    },
    "authAlert": {
      "enabled": false
    },
    "fields+": [{
      "name": "role",
      "type": "select",
      "values": ["admin", "analyst", "viewer"],
      "maxSelect": 1
    }]
  }' > /dev/null || echo "  note: role field may already exist on users"

if collection_exists "sites"; then
  echo "Bootstrap: collections already exist, applying rules..."
else
  echo "Bootstrap: creating collections..."

SITES_RESP=$(create_collection "{
  \"name\": \"sites\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"@request.auth.id != \\\"\\\"\",
  \"updateRule\": \"@request.auth.id != \\\"\\\"\",
  \"deleteRule\": \"@request.auth.id != \\\"\\\"\",
  \"fields\": [
    {\"name\": \"name\", \"type\": \"text\", \"required\": true},
    {\"name\": \"url\", \"type\": \"url\", \"required\": true},
    {\"name\": \"description\", \"type\": \"text\"},
    {\"name\": \"owner\", \"type\": \"relation\", \"collectionId\": \"$USERS_ID\", \"maxSelect\": 1},
    {\"name\": \"crawl_schedule\", \"type\": \"select\", \"values\": [\"manual\", \"hourly\", \"every_6h\", \"daily\", \"weekly\", \"monthly\"], \"maxSelect\": 1},
    {\"name\": \"custom_headers\", \"type\": \"json\"},
    {\"name\": \"auth_config\", \"type\": \"json\"},
    {\"name\": \"default_scan_config\", \"type\": \"json\"}
  ]
}")
SITES_ID=$(extract_id "$SITES_RESP")
echo "  created sites ($SITES_ID)"

SCANS_RESP=$(create_collection "{
  \"name\": \"scans\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"site\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SITES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"status\", \"type\": \"select\", \"values\": [\"queued\", \"running\", \"complete\", \"failed\"], \"maxSelect\": 1},
    {\"name\": \"scan_type\", \"type\": \"select\", \"values\": [\"full\", \"accessibility_only\", \"qa_only\"], \"maxSelect\": 1},
    {\"name\": \"pages_crawled\", \"type\": \"number\", \"min\": 0},
    {\"name\": \"started_at\", \"type\": \"date\"},
    {\"name\": \"completed_at\", \"type\": \"date\"},
    {\"name\": \"wcag_version\", \"type\": \"select\", \"values\": [\"2.1\", \"2.2\"], \"maxSelect\": 1},
    {\"name\": \"score_a\", \"type\": \"number\", \"min\": 0, \"max\": 100},
    {\"name\": \"score_aa\", \"type\": \"number\", \"min\": 0, \"max\": 100},
    {\"name\": \"score_aaa\", \"type\": \"number\", \"min\": 0, \"max\": 100},
    {\"name\": \"score_qa\", \"type\": \"number\", \"min\": 0, \"max\": 100},
    {\"name\": \"raw_config\", \"type\": \"json\"},
    {\"name\": \"diff_summary\", \"type\": \"json\"}
  ]
}")
SCANS_ID=$(extract_id "$SCANS_RESP")
echo "  created scans ($SCANS_ID)"

PAGES_RESP=$(create_collection "{
  \"name\": \"pages\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"site\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SITES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"url\", \"type\": \"url\", \"required\": true},
    {\"name\": \"title\", \"type\": \"text\"},
    {\"name\": \"status_code\", \"type\": \"number\"},
    {\"name\": \"last_modified\", \"type\": \"date\"},
    {\"name\": \"word_count\", \"type\": \"number\", \"min\": 0},
    {\"name\": \"readability_score\", \"type\": \"number\"},
    {\"name\": \"crawl_depth\", \"type\": \"number\", \"min\": 0},
    {\"name\": \"html_snapshot\", \"type\": \"text\", \"max\": 500000}
  ]
}")
PAGES_ID=$(extract_id "$PAGES_RESP")
echo "  created pages ($PAGES_ID)"

create_collection "{
  \"name\": \"accessibility_issues\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"@request.auth.id != \\\"\\\"\",
  \"deleteRule\": \"@request.auth.id != \\\"\\\"\",
  \"fields\": [
    {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"page\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$PAGES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"rule_id\", \"type\": \"text\", \"required\": true},
    {\"name\": \"wcag_level\", \"type\": \"select\", \"values\": [\"A\", \"AA\", \"AAA\"], \"maxSelect\": 1},
    {\"name\": \"wcag_sc\", \"type\": \"text\"},
    {\"name\": \"wcag_version\", \"type\": \"select\", \"values\": [\"2.0\", \"2.1\", \"2.2\"], \"maxSelect\": 1},
    {\"name\": \"impact\", \"type\": \"select\", \"values\": [\"critical\", \"serious\", \"moderate\", \"minor\"], \"maxSelect\": 1},
    {\"name\": \"type\", \"type\": \"select\", \"values\": [\"error\", \"warning\", \"review\"], \"maxSelect\": 1},
    {\"name\": \"element_type\", \"type\": \"select\", \"values\": [\"image\", \"form\", \"link\", \"heading\", \"table\", \"media\", \"aria\", \"other\"], \"maxSelect\": 1},
    {\"name\": \"responsible_role\", \"type\": \"select\", \"values\": [\"developer\", \"editor\", \"designer\"], \"maxSelect\": 1},
    {\"name\": \"help_url\", \"type\": \"url\"},
    {\"name\": \"description\", \"type\": \"text\"},
    {\"name\": \"html_snippet\", \"type\": \"text\", \"max\": 10000},
    {\"name\": \"css_selector\", \"type\": \"text\"},
    {\"name\": \"fix_suggestion\", \"type\": \"text\", \"max\": 10000},
    {\"name\": \"status\", \"type\": \"select\", \"values\": [\"open\", \"dismissed\", \"fixed\"], \"maxSelect\": 1},
    {\"name\": \"dismissed_by\", \"type\": \"relation\", \"collectionId\": \"$USERS_ID\", \"maxSelect\": 1},
    {\"name\": \"dismissed_at\", \"type\": \"date\"},
    {\"name\": \"dismiss_reason\", \"type\": \"text\"}
  ]
}" > /dev/null
echo "  created accessibility_issues"

create_collection "{
  \"name\": \"qa_broken_links\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"@request.auth.id != \\\"\\\"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"page\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$PAGES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"href\", \"type\": \"url\", \"required\": true},
    {\"name\": \"status_code\", \"type\": \"number\"},
    {\"name\": \"link_type\", \"type\": \"select\", \"values\": [\"internal\", \"external\"], \"maxSelect\": 1},
    {\"name\": \"status\", \"type\": \"select\", \"values\": [\"broken\", \"redirected\", \"dismissed\"], \"maxSelect\": 1}
  ]
}" > /dev/null
echo "  created qa_broken_links"

create_collection "{
  \"name\": \"qa_spelling\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"@request.auth.id != \\\"\\\"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"page\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$PAGES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"word\", \"type\": \"text\", \"required\": true},
    {\"name\": \"context\", \"type\": \"text\"},
    {\"name\": \"confidence\", \"type\": \"select\", \"values\": [\"error\", \"review\"], \"maxSelect\": 1},
    {\"name\": \"status\", \"type\": \"select\", \"values\": [\"open\", \"dismissed\", \"false_positive\"], \"maxSelect\": 1}
  ]
}" > /dev/null
echo "  created qa_spelling"

create_collection "{
  \"name\": \"qa_inventory\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"url\", \"type\": \"url\", \"required\": true},
    {\"name\": \"content_type\", \"type\": \"text\"},
    {\"name\": \"size_bytes\", \"type\": \"number\", \"min\": 0},
    {\"name\": \"mime_type\", \"type\": \"text\"},
    {\"name\": \"is_pdf\", \"type\": \"bool\"},
    {\"name\": \"pdf_accessibility_score\", \"type\": \"number\", \"min\": 0, \"max\": 100}
  ]
}" > /dev/null
echo "  created qa_inventory"

POLICIES_RESP=$(create_collection "{
  \"name\": \"policies\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"@request.auth.id != \\\"\\\"\",
  \"updateRule\": \"@request.auth.id != \\\"\\\"\",
  \"deleteRule\": \"@request.auth.id != \\\"\\\"\",
  \"fields\": [
    {\"name\": \"site\", \"type\": \"relation\", \"collectionId\": \"$SITES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"name\", \"type\": \"text\", \"required\": true},
    {\"name\": \"description\", \"type\": \"text\"},
    {\"name\": \"rule_type\", \"type\": \"select\", \"values\": [\"keyword\", \"regex\", \"html_attribute\"], \"maxSelect\": 1},
    {\"name\": \"pattern\", \"type\": \"text\", \"required\": true},
    {\"name\": \"category\", \"type\": \"select\", \"values\": [\"qa\", \"brand\", \"accessibility\", \"security\"], \"maxSelect\": 1},
    {\"name\": \"severity\", \"type\": \"select\", \"values\": [\"error\", \"warning\"], \"maxSelect\": 1},
    {\"name\": \"enabled\", \"type\": \"bool\"}
  ]
}")
POLICIES_ID=$(extract_id "$POLICIES_RESP")
echo "  created policies ($POLICIES_ID)"

create_collection "{
  \"name\": \"policy_matches\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"\",
  \"updateRule\": \"@request.auth.id != \\\"\\\"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"scan\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SCANS_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"policy\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$POLICIES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"page\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$PAGES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"matched_text\", \"type\": \"text\"},
    {\"name\": \"context\", \"type\": \"text\"},
    {\"name\": \"status\", \"type\": \"select\", \"values\": [\"open\", \"dismissed\", \"fixed\"], \"maxSelect\": 1}
  ]
}" > /dev/null
echo "  created policy_matches"

create_collection "{
  \"name\": \"scan_queue\",
  \"type\": \"base\",
  \"listRule\": \"@request.auth.id != \\\"\\\"\",
  \"viewRule\": \"@request.auth.id != \\\"\\\"\",
  \"createRule\": \"@request.auth.id != \\\"\\\"\",
  \"updateRule\": \"\",
  \"deleteRule\": \"\",
  \"fields\": [
    {\"name\": \"site\", \"type\": \"relation\", \"required\": true, \"collectionId\": \"$SITES_ID\", \"maxSelect\": 1, \"cascadeDelete\": true},
    {\"name\": \"priority\", \"type\": \"number\", \"min\": 0},
    {\"name\": \"requested_by\", \"type\": \"relation\", \"collectionId\": \"$USERS_ID\", \"maxSelect\": 1},
    {\"name\": \"scan_type\", \"type\": \"select\", \"values\": [\"full\", \"accessibility_only\", \"qa_only\"], \"maxSelect\": 1},
    {\"name\": \"target_url\", \"type\": \"url\"},
    {\"name\": \"raw_config\", \"type\": \"json\"},
    {\"name\": \"status\", \"type\": \"select\", \"values\": [\"pending\", \"processing\", \"complete\", \"failed\"], \"maxSelect\": 1}
  ]
}" > /dev/null
echo "  created scan_queue"

fi

ensure_collection_rules() {
  patch_collection() {
    col="$1"
    payload="$2"
    if collection_exists "$col"; then
      curl -sf -X PATCH "$PB_URL/api/collections/$col" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "$payload" > /dev/null || echo "  note: could not patch rules for $col"
      echo "  ensured API rules for $col"
    fi
  }

  AUTH_ONLY='{
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\""
  }'

  READ_ONLY='{
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  }'

  READ_UPDATE='{
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\""
  }'

  READ_UPDATE_NO_DELETE='{
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": ""
  }'

  SCAN_QUEUE='{
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "",
    "deleteRule": ""
  }'

  patch_collection sites "$AUTH_ONLY"
  patch_collection scans "$READ_ONLY"
  patch_collection pages "$READ_ONLY"
  patch_collection accessibility_issues "$READ_UPDATE"
  patch_collection qa_broken_links "$READ_UPDATE_NO_DELETE"
  patch_collection qa_spelling "$READ_UPDATE_NO_DELETE"
  patch_collection qa_inventory "$READ_ONLY"
  patch_collection policies "$AUTH_ONLY"
  patch_collection policy_matches "$READ_UPDATE_NO_DELETE"
  patch_collection scan_queue "$SCAN_QUEUE"
}

ensure_collection_rules

echo "Bootstrap complete."
