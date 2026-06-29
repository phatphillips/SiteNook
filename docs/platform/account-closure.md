# Account closure and billing lifecycle

AccessIQ supports organization closure (churn/offboarding), Stripe Customer Portal billing management, and automatic data purge after a retention period.

For signup and paid onboarding, see [onboarding.md](./onboarding.md) and [stripe-setup.md](./stripe-setup.md). For team member removal (not org closure), see [users-and-teams.md](./users-and-teams.md).

---

## Overview

| Concern | Where it lives |
|---------|----------------|
| Org lifecycle fields | `organizations.status`, `closed_at`, `purge_scheduled_at`, `closed_by` |
| Stripe linkage | `organizations.stripe_customer_id`, `stripe_subscription_id`, `subscription_status` |
| Billing UI | **Settings → Billing** (`/settings/billing`) — Stripe Customer Portal |
| Close org UI | **Settings → General** danger zone (`/settings`) |
| Close API | `POST /api/close-organization` (org admin, name confirmation) |
| Portal API | `POST /api/stripe/create-portal-session` (org admin) |
| Purge job | `cd apps/scanner && npm run purge-closed-orgs` |
| Access block | `/account-closed`, login + tenant middleware |

---

## Closure model (soft close)

1. An org **admin** closes the organization from Settings → General.
2. The org enters `status: closing` immediately.
3. Active Stripe subscriptions are **canceled immediately**.
4. Pending scans are canceled; scheduled scans stop for closing orgs.
5. All team members are **blocked from sign-in** (redirect to `/account-closed`).
6. Data is retained for **30 days**, then permanently deleted by the purge job.
7. The subdomain becomes available again after purge.

Team member removal (admin deletes a colleague) is unchanged and does not close the org.

---

## Stripe Customer Portal

Admins with a linked `stripe_customer_id` can open the hosted portal from **Settings → Billing**.

**Stripe Dashboard setup:**

1. **Settings → Billing → Customer portal** — enable the portal.
2. Allow customers to **cancel subscriptions** and **update payment methods** (minimum for v1).
3. Register webhook events (in addition to `checkout.session.completed`):
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

Portal cancel starts the same **30-day soft close** as **Close organization**. After canceling in Stripe, open **Settings → Billing** and click **Refresh billing status** (or wait for the webhook). The page shows a warning alert when the org is closing.

**Email:** Closure emails go to users with `is_billing_contact = true`. Requires PocketBase **Settings → Mail settings** (SMTP). Use **Send test email** in PocketBase admin to verify SMTP before testing cancel.

---

## APIs

### `POST /api/stripe/create-portal-session`

- **Auth:** PocketBase user JWT (`Authorization: Bearer …`)
- **Role:** org `admin`
- **Requires:** `organizations.stripe_customer_id`, `status: active`
- **Returns:** `{ url }` — redirect the browser to Stripe

### `POST /api/close-organization`

- **Auth:** PocketBase user JWT
- **Role:** org `admin`
- **Body:** `{ "confirmName": "<exact organization name>" }`
- **Returns:** `{ organizationId, subdomain, purgeScheduledAt, subscriptionCanceled }`

---

## Purge job

Permanently deletes organizations where `status = closing` **and** `purge_scheduled_at <= now`.

**Full dev guide:** [dev-operations.md](../operations/dev-operations.md) (env vars, Docker exec, clean slate, troubleshooting).

### Quick reference

```powershell
# Dev: purge immediately (skip 30-day grace)
cd apps\scanner
npm run purge-closed-orgs -- --org-id=<organization_id> --force

# Production-style: only orgs past purge_scheduled_at
npm run purge-closed-orgs
```

Scripts auto-load repo root `.env` (`PB_ADMIN_*` → `POCKETBASE_ADMIN_*`). See [dev-operations.md](../operations/dev-operations.md).

### Docker

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml exec scanner npm run purge-closed-orgs -- --org-id=<id> --force
```

**Dev testing without `--force`:** set `purge_scheduled_at` to yesterday in PocketBase admin first.

**Optional automatic purge** in the scanner worker:

```bash
SCANNER_PURGE_CLOSED_ORGS=true
SCANNER_PURGE_TICK_MS=86400000   # default: 24h
```

Deletion order per org: scan queue → log events → findings → scans → policies → sites → activity log → checkout sessions → users → organization.

---

## Manual smoke checklist

1. **Billing portal:** Paid org → Settings → Billing → **Manage billing** → Stripe portal opens.
2. **Portal cancel:** Cancel subscription in portal → webhook sets org to `status: closing` (same as manual close); login blocked; purge after 30 days.
3. **Close org:** Admin → Settings → General → **Close organization** → confirm name → redirected to `/account-closed`.
4. **Login block:** Former member cannot sign in; sees closure message.
5. **Purge (dev):** Set `purge_scheduled_at` to **before today** (not +30 days) → run purge → org removed. See [dev-operations.md](../operations/dev-operations.md).

---

## PocketBase migration

Apply `1730000030_organizations_billing_lifecycle.js`:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build --force-recreate pocketbase web
```

Backfills Stripe IDs from consumed `stripe_checkout_sessions` rows where present.
