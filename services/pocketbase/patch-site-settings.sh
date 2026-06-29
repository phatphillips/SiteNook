#!/bin/sh
# Adds sites.site_settings and backfills from legacy default_scan_config fields.
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
  echo "Patch site-settings: could not authenticate, skipping."
  exit 0
fi

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
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
    echo "  added $col.$field"
  else
    echo "  note: could not add $col.$field"
  fi
}

backfill_site_settings() {
  if ! collection_exists sites; then
    return
  fi

  page=1
  per_page=50
  while :; do
    resp=$(curl -sf "$PB_URL/api/collections/sites/records?page=$page&perPage=$per_page" -H "$AUTH" || echo "")
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
      settings=$(echo "$record" | jq -c '.site_settings // null')
      config=$(echo "$record" | jq -c '.default_scan_config // {}')

      if [ "$settings" != "null" ] && [ "$(echo "$settings" | jq 'if type == "object" then length else 0 end')" -gt 0 ]; then
        continue
      fi

      derived=$(echo "$config" | jq -c '
        {
          wcagVersion: (if (.wcagVersion == "2.0" or .wcagVersion == "2.1" or .wcagVersion == "2.2") then .wcagVersion else "2.2" end),
          wcagConformance: (
            if ((.wcagLevels // []) | index("AAA")) then "AAA"
            elif ((.wcagLevels // []) | index("AA")) then "AA"
            elif ((.wcagLevels // []) | index("A")) then "A"
            else "AA" end
          ),
          ariaConformance: true,
          bestPractices: (.bestPractices != false),
          includeIssues: true,
          includePotentialIssues: true,
          checkLinks: (.checkLinks != false),
          checkSpelling: (.checkSpelling != false),
          spellLanguage: (.spellLanguage // "en-AU"),
          checkReadability: (.checkReadability != false),
          readabilityMethods: ["flesch_kincaid_grade"],
          runPolicies: (.runPolicies != false),
          notifyEmail: (if (.notifyEmail | type) == "string" then .notifyEmail else null end),
          diffFromPrevious: (.diffFromPrevious != false)
        }
      ')

      curl -sf -X PATCH "$PB_URL/api/collections/sites/records/$id" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "{\"site_settings\": $derived}" > /dev/null \
        && echo "  backfilled site_settings for $id" \
        || echo "  note: could not backfill site_settings for $id"
    done

    if [ "$page" -ge "$total_pages" ]; then
      break
    fi
    page=$((page + 1))
  done
}

echo "Patch: site_settings field..."
add_json_field sites site_settings
add_json_field pages readability_scores
backfill_site_settings
echo "Patch: site_settings done."
