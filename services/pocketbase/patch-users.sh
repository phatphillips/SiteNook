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

AUTH="Authorization: Bearer $TOKEN"

collection_exists() {
  code=$(curl -s -o /dev/null -w "%{http_code}" "$PB_URL/api/collections/$1" -H "$AUTH")
  [ "$code" = "200" ]
}

ensure_role_field() {
  body=$(curl -sf "$PB_URL/api/collections/users" -H "$AUTH")
  exists=$(echo "$body" | jq -e '.fields[] | select(.name == "role")' > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  users.role already exists"
    return
  fi

  updated_fields=$(echo "$body" | jq '.fields += [{
    "name": "role",
    "type": "select",
    "required": false,
    "presentable": false,
    "system": false,
    "values": ["admin", "viewer"],
    "maxSelect": 1
  }]')

  if curl -sf -X PATCH "$PB_URL/api/collections/users" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added users.role"
  else
    echo "  note: could not add users.role"
  fi
}

ensure_role_values() {
  body=$(curl -sf "$PB_URL/api/collections/users" -H "$AUTH")
  current=$(echo "$body" | jq -c '.fields[] | select(.name == "role") | .values')
  target='["admin","viewer"]'
  if [ "$current" = "$target" ]; then
    echo "  users.role values already admin/viewer"
    return
  fi

  updated_fields=$(echo "$body" | jq '
    .fields = [.fields[] | if .name == "role" then .values = ["admin", "viewer"] else . end]
  ')

  if curl -sf -X PATCH "$PB_URL/api/collections/users" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  set users.role values to admin/viewer"
  else
    echo "  note: could not update users.role values"
  fi
}

ensure_billing_contact_field() {
  body=$(curl -sf "$PB_URL/api/collections/users" -H "$AUTH")
  exists=$(echo "$body" | jq -e '.fields[] | select(.name == "is_billing_contact")' > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  users.is_billing_contact already exists"
    return
  fi

  updated_fields=$(echo "$body" | jq '.fields += [{
    "name": "is_billing_contact",
    "type": "bool",
    "required": false,
    "presentable": false,
    "system": false
  }]')

  if curl -sf -X PATCH "$PB_URL/api/collections/users" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added users.is_billing_contact"
  else
    echo "  note: could not add users.is_billing_contact"
  fi
}

sync_team_activity_log_rules() {
  body=$(curl -sf "$PB_URL/api/collections/team_activity_log" -H "$AUTH")
  target_list='organization = @request.auth.organization'
  target_view='organization = @request.auth.organization'
  current_list=$(echo "$body" | jq -r '.listRule // ""')
  current_view=$(echo "$body" | jq -r '.viewRule // ""')

  if [ "$current_list" = "$target_list" ] && [ "$current_view" = "$target_view" ]; then
    echo "  team_activity_log rules already synced"
    return
  fi

  updated=$(echo "$body" | jq --arg list "$target_list" --arg view "$target_view" '
    .listRule = $list |
    .viewRule = $view |
    .createRule = "" |
    .updateRule = "" |
    .deleteRule = ""
  ')

  if curl -sf -X PATCH "$PB_URL/api/collections/team_activity_log" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated" > /dev/null; then
    echo "  synced team_activity_log list/view rules"
  else
    echo "  note: could not sync team_activity_log rules"
  fi
}

ensure_team_activity_logged_at_field() {
  if ! collection_exists "team_activity_log"; then
    return
  fi

  body=$(curl -sf "$PB_URL/api/collections/team_activity_log" -H "$AUTH")
  exists=$(echo "$body" | jq -e '.fields[] | select(.name == "logged_at")' > /dev/null 2>&1 && echo yes || echo "")
  if [ -n "$exists" ]; then
    echo "  team_activity_log.logged_at already exists"
    return
  fi

  updated_fields=$(echo "$body" | jq '.fields += [{
    "name": "logged_at",
    "type": "autodate",
    "required": false,
    "onCreate": true,
    "onUpdate": false
  }]')

  if curl -sf -X PATCH "$PB_URL/api/collections/team_activity_log" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated_fields" > /dev/null; then
    echo "  added team_activity_log.logged_at"
  else
    echo "  note: could not add team_activity_log.logged_at"
  fi
}

ensure_team_activity_log_collection() {
  if collection_exists "team_activity_log"; then
    echo "  team_activity_log collection already exists"
    sync_team_activity_log_rules
    ensure_team_activity_logged_at_field
    return
  fi

  if ! collection_exists "organizations"; then
    echo "  note: organizations collection missing, skipping team_activity_log"
    return
  fi

  org_id=$(curl -sf "$PB_URL/api/collections/organizations" -H "$AUTH" | jq -r '.id')
  users_id=$(curl -sf "$PB_URL/api/collections/users" -H "$AUTH" | jq -r '.id')

  payload=$(jq -n \
    --arg org_id "$org_id" \
    --arg users_id "$users_id" \
    '{
      "name": "team_activity_log",
      "type": "base",
      "listRule": "organization = @request.auth.organization",
      "viewRule": "organization = @request.auth.organization",
      "createRule": "",
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
          "name": "actor",
          "type": "relation",
          "required": false,
          "collectionId": $users_id,
          "maxSelect": 1,
          "cascadeDelete": false
        },
        {
          "name": "target",
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
          "values": [
            "member_added",
            "member_removed",
            "role_changed",
            "billing_contact_added",
            "billing_contact_removed",
            "invite_resent"
          ]
        },
        {
          "name": "details",
          "type": "json",
          "required": false
        },
        {
          "name": "logged_at",
          "type": "autodate",
          "required": false,
          "onCreate": true,
          "onUpdate": false
        }
      ],
      "indexes": [
        "CREATE INDEX idx_team_activity_org ON team_activity_log (organization)"
      ]
    }')

  if curl -sf -X POST "$PB_URL/api/collections" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$payload" > /dev/null; then
    echo "  created team_activity_log collection"
  else
    echo "  note: could not create team_activity_log collection"
  fi
}

migrate_legacy_roles() {
  page=1
  migrated=0
  while true; do
    resp=$(curl -sf "$PB_URL/api/collections/users/records?filter=(role='owner'%7C%7Crole='analyst')&perPage=100&page=$page" -H "$AUTH" || echo '{"items":[]}')
    count=$(echo "$resp" | jq '.items | length')
    if [ "$count" = "0" ] || [ -z "$count" ]; then
      break
    fi

    echo "$resp" | jq -c '.items[]' | while read -r user; do
      user_id=$(echo "$user" | jq -r '.id')
      role=$(echo "$user" | jq -r '.role')
      patch='{}'
      if [ "$role" = "owner" ]; then
        patch='{"role":"admin","is_billing_contact":true}'
      elif [ "$role" = "analyst" ]; then
        patch='{"role":"viewer","is_billing_contact":false}'
      fi
      if [ "$patch" != "{}" ]; then
        curl -sf -X PATCH "$PB_URL/api/collections/users/records/$user_id" \
          -H "Content-Type: application/json" \
          -H "$AUTH" \
          -d "$patch" > /dev/null || true
        migrated=$((migrated + 1))
      fi
    done

    if [ "$count" -lt 100 ]; then
      break
    fi
    page=$((page + 1))
  done

  if [ "$migrated" -gt 0 ]; then
    echo "  migrated $migrated user(s) from owner/analyst roles"
  else
    echo "  no owner/analyst users to migrate"
  fi
}

sanity_check_orgs() {
  if ! collection_exists "organizations"; then
    return
  fi

  orgs=$(curl -sf "$PB_URL/api/collections/organizations/records?perPage=200" -H "$AUTH" || echo '{"items":[]}')
  echo "$orgs" | jq -c '.items[]' | while read -r org; do
    org_id=$(echo "$org" | jq -r '.id')
    org_name=$(echo "$org" | jq -r '.name // .subdomain // .id')
    admin_count=$(curl -sf "$PB_URL/api/collections/users/records?filter=(organization='$org_id'%26%26role='admin')&perPage=1" -H "$AUTH" | jq '.totalItems // 0')
    billing_count=$(curl -sf "$PB_URL/api/collections/users/records?filter=(organization='$org_id'%26%26is_billing_contact=true)&perPage=1" -H "$AUTH" | jq '.totalItems // 0')
    if [ "$admin_count" = "0" ] || [ "$billing_count" = "0" ]; then
      echo "  WARNING: organization \"$org_name\" ($org_id) has admin_count=$admin_count billing_count=$billing_count after role migration"
    fi
  done
}

ORG_MANAGER='@request.auth.role = \"admin\"'

ensure_reset_password_template() {
  DASHBOARD_URL="${APP_DASHBOARD_URL:-http://localhost:3000}"
  DASHBOARD_URL=$(echo "$DASHBOARD_URL" | sed 's:/*$::')

  body=$(curl -sf "$PB_URL/api/collections/users" -H "$AUTH")
  current_url=$(echo "$body" | jq -r '.resetPasswordTemplate.body // ""' | grep -oE 'href="[^"]+' | head -1 | sed 's/href="//' || true)
  target_fragment="${DASHBOARD_URL}/reset-password?token={TOKEN}"

  if echo "$current_url" | grep -qF "$target_fragment"; then
    echo "  users.resetPasswordTemplate already points at SiteNook"
    return
  fi

  updated=$(echo "$body" | jq --arg url "$target_fragment" '
    .resetPasswordTemplate = {
      "subject": (.resetPasswordTemplate.subject // "Set up your {APP_NAME} account"),
      "body": ("<p>Hello,</p>\n<p>Click the button below to set up your account and choose a password.</p>\n<p><a href=\"" + $url + "\" target=\"_blank\" rel=\"noopener\">Set up account</a></p>\n<p>If you did not expect this email, you can ignore it.</p>\n<p>Thanks,<br/>{APP_NAME} team</p>")
    }
  ')

  if curl -sf -X PATCH "$PB_URL/api/collections/users" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "$updated" > /dev/null; then
    echo "  set users.resetPasswordTemplate action URL to ${DASHBOARD_URL}/reset-password"
  else
    echo "  note: could not patch users.resetPasswordTemplate"
  fi
}

echo "Patch: updating users collection settings..."
ensure_role_field
ensure_role_values
ensure_billing_contact_field
ensure_team_activity_log_collection
migrate_legacy_roles
sanity_check_orgs
ensure_reset_password_template

curl -sf -X PATCH "$PB_URL/api/collections/users" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{
    \"createRule\": \"@request.auth.id != \\\"\\\" && ${ORG_MANAGER} && organization = @request.auth.organization\",
    \"listRule\": \"organization = @request.auth.organization\",
    \"viewRule\": \"organization = @request.auth.organization\",
    \"updateRule\": \"id = @request.auth.id || (${ORG_MANAGER} && organization = @request.auth.organization)\",
    \"deleteRule\": \"${ORG_MANAGER} && organization = @request.auth.organization && id != @request.auth.id\"
  }" > /dev/null || echo "  note: users rules patch may partially apply"

# Keep new-device login alerts on. Branding comes from settings.meta.appName (SiteNook).
# Separate PATCH so a rules failure cannot leave authAlert stuck in a bad state.
ensure_auth_alert() {
  if curl -sf -X PATCH "$PB_URL/api/collections/users" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{
      "authAlert": {
        "enabled": true,
        "emailTemplate": {
          "subject": "Login from a new device",
          "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new device or location.</p>\n<p>If this was you, you may disregard this email.</p>\n<p><strong>If this was not you, change your {APP_NAME} account password immediately to revoke access from other sessions.</strong></p>\n<p>Thanks,<br/>{APP_NAME} team</p>"
        }
      }
    }' > /dev/null; then
    echo "  authAlert enabled (new-device login emails)"
  else
    echo "  note: could not update users.authAlert"
  fi
}

ensure_auth_alert

echo "Patch: ensured role/billing fields and auth alert."

if [ -n "$APP_USER_EMAIL" ] && [ -n "$APP_USER_PASSWORD" ]; then
  EXISTING=$(curl -sf "$PB_URL/api/collections/users/records?filter=(email='$APP_USER_EMAIL')" \
    -H "$AUTH")
  USER_ID=$(echo "$EXISTING" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  ORG_ID=$(echo "$EXISTING" | sed -n 's/.*"organization":"\([^"]*\)".*/\1/p' | head -1)

  if [ -n "$USER_ID" ]; then
    TARGET_ROLE="admin"
    BILLING_JSON="false"
    if [ -n "$ORG_ID" ]; then
      BILLING_COUNT=$(curl -sf "$PB_URL/api/collections/users/records?filter=(organization='$ORG_ID'%26%26is_billing_contact=true)&perPage=1" \
        -H "$AUTH" | jq '.totalItems // 0')
      if [ "$BILLING_COUNT" = "0" ]; then
        BILLING_JSON="true"
      fi
    fi

    # Only rewrite the password when APP_USER_PASSWORD in env changes.
    # Re-hashing on every boot clears _authOrigins (known devices) and causes
    # "login from a new device" spam. Do not probe via auth-with-password here;
    # that would itself create a localhost fingerprint / alert.
    PASS_MARKER="/pb/pb_data/.app_user_password_sha"
    NEW_PASS_HASH=$(printf '%s' "$APP_USER_PASSWORD" | sha256sum | awk '{print $1}')
    OLD_PASS_HASH=""
    if [ -f "$PASS_MARKER" ]; then
      OLD_PASS_HASH=$(cat "$PASS_MARKER" 2>/dev/null || true)
    fi

    NEED_PASSWORD=0
    if [ -z "$OLD_PASS_HASH" ]; then
      # First run of this marker logic: assume password already matches env
      # (previous boots re-hashed every time). Persist marker without resetting.
      printf '%s\n' "$NEW_PASS_HASH" > "$PASS_MARKER"
    elif [ "$NEW_PASS_HASH" != "$OLD_PASS_HASH" ]; then
      NEED_PASSWORD=1
    fi

    if [ "$NEED_PASSWORD" = "1" ]; then
      curl -sf -X PATCH "$PB_URL/api/collections/users/records/$USER_ID" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "{
          \"verified\": true,
          \"role\": \"$TARGET_ROLE\",
          \"is_billing_contact\": $BILLING_JSON,
          \"password\": \"$APP_USER_PASSWORD\",
          \"passwordConfirm\": \"$APP_USER_PASSWORD\"
        }" > /dev/null || true
      printf '%s\n' "$NEW_PASS_HASH" > "$PASS_MARKER"
      echo "Patch: reset app user password (APP_USER_PASSWORD changed), role=$TARGET_ROLE, is_billing_contact=$BILLING_JSON for $APP_USER_EMAIL"
    else
      curl -sf -X PATCH "$PB_URL/api/collections/users/records/$USER_ID" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "{
          \"verified\": true,
          \"role\": \"$TARGET_ROLE\",
          \"is_billing_contact\": $BILLING_JSON
        }" > /dev/null || true
      echo "Patch: synced app user role=$TARGET_ROLE, is_billing_contact=$BILLING_JSON, verified=true for $APP_USER_EMAIL (password unchanged)"
    fi
  fi
fi

echo "Patch complete."
