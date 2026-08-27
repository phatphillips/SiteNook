# Stripe setup (Phase G)

SiteNook uses **Stripe Checkout** (hosted, test mode first) for **Starter**, **Team**, and **Business** subscriptions. **Free** skips Stripe; **Enterprise** stays sales-led (mailto).

This guide covers Stripe setup through the full paid signup funnel (Phases G3–G9). Checkout API, webhook, `/start` gating, and plan on org are implemented in the app.

---

## Prerequisites

- Stripe account in **Test mode** ([dashboard.stripe.com/test](https://dashboard.stripe.com/test))
- SiteNook marketing + self-service flags for local funnel testing:

```bash
NUXT_PUBLIC_MARKETING_SITE=true
NUXT_PUBLIC_SELF_SERVICE_SIGNUP=true
NUXT_PUBLIC_STRIPE_DEV_BYPASS=true   # optional — skip Stripe without keys (localhost only)
```

---

## 1. Create products and prices (Test mode)

In Stripe Dashboard → **Product catalog**, create three recurring monthly products that match `/pricing`:

| Product | Monthly price | Env var |
|---------|---------------|---------|
| `SiteNook Starter` | **USD $39** | `NUXT_STRIPE_STARTER_PRICE_ID` |
| `SiteNook Team` | **USD $99** | `NUXT_STRIPE_TEAM_PRICE_ID` |
| `SiteNook Business` | **USD $249** | `NUXT_STRIPE_BUSINESS_PRICE_ID` |

Optional annual prices (~15% discount) for the pricing-page toggle:

| Product | Annual price (billed yearly) | Env var |
|---------|------------------------------|---------|
| Starter | $396/year ($33/mo effective) | `NUXT_STRIPE_STARTER_ANNUAL_PRICE_ID` |
| Team | $1,008/year ($84/mo effective) | `NUXT_STRIPE_TEAM_ANNUAL_PRICE_ID` |
| Business | $2,544/year ($212/mo effective) | `NUXT_STRIPE_BUSINESS_ANNUAL_PRICE_ID` |

After saving each product, open it → under **Pricing**, click the price row → copy the **Price ID** (`price_…`).

> **Important:** Use **Price ID** (`price_…`), not **Product ID** (`prod_…`). If checkout fails, double-check these values in `.env`.

Legacy installs may still use `NUXT_STRIPE_STANDARD_PRICE_ID` as an alias for the Team monthly price.

Optional metadata (recommended):

| Object | Key | Value |
|--------|-----|--------|
| Product or Price | `sitenook_plan` | `starter`, `team`, or `business` |

**Enterprise** hosted org plans are not sold via Stripe — customers contact support from `/pricing`.

**Self-host licence** (appliance unlock) is a separate Stripe product:

| Product | Env vars | Checkout |
|---------|----------|----------|
| SiteNook Self-host | `NUXT_STRIPE_SELFHOST_PRICE_ID`, `NUXT_STRIPE_SELFHOST_ANNUAL_PRICE_ID` | `POST /api/stripe/create-selfhost-checkout-session` from `/download` |

Metadata: `sitenook_product=selfhost`. Webhook creates a `licences` row (`tier=selfhost`) and emails the key.

See [public-sku-sheet.md](./public-sku-sheet.md) and [self-host-operator-setup.md](./self-host-operator-setup.md).

---

## 2. API keys (Test mode)

Dashboard → **Developers** → **API keys**:

| Key | Env var | Notes |
|-----|---------|--------|
| Publishable key `pk_test_…` | `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Safe for browser (Checkout Sessions are mostly server-driven) |
| Secret key `sk_test_…` | `NUXT_STRIPE_SECRET_KEY` | **Server only** — never commit |

Add to repo root `.env` (Docker Compose) or `apps/web/.env` (local Nuxt):

```bash
NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NUXT_STRIPE_SECRET_KEY=sk_test_...
NUXT_STRIPE_STARTER_PRICE_ID=price_...
NUXT_STRIPE_TEAM_PRICE_ID=price_...
NUXT_STRIPE_BUSINESS_PRICE_ID=price_...
# Optional annual prices:
# NUXT_STRIPE_TEAM_ANNUAL_PRICE_ID=price_...
# Self-host appliance licence:
# NUXT_STRIPE_SELFHOST_PRICE_ID=price_...
# NUXT_STRIPE_SELFHOST_ANNUAL_PRICE_ID=price_...
```

When `NUXT_STRIPE_SECRET_KEY` and at least `NUXT_STRIPE_TEAM_PRICE_ID` (or legacy `NUXT_STRIPE_STANDARD_PRICE_ID`) are set, `/pricing` shows active **Subscribe** buttons (`POST /api/stripe/create-checkout-session` with `{ plan, interval }`).

---

## 3. Webhook (G5)

**`POST /api/stripe/webhook`** verifies Stripe signatures and stores paid checkout sessions in PocketBase (`stripe_checkout_sessions`) for `/start` gating (G6).

Local development uses the **Stripe CLI** to forward events to Nitro:

```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the signing secret (`whsec_…`) to:

```bash
NUXT_STRIPE_WEBHOOK_SECRET=whsec_...
```

Keep `stripe listen` running while testing checkout. After payment you should see `checkout.session.completed` forwarded with HTTP **200**.

**Phase I — subscription lifecycle events** (register in Stripe Dashboard → Webhooks, or use `stripe listen`):

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | Paid signup — store checkout session for `/start` |
| `customer.subscription.updated` | Sync `subscription_status` / plan on org |
| `customer.subscription.deleted` | Portal cancel — downgrade to `free` if org still active |
| `invoice.payment_failed` | Set `subscription_status: past_due` |

See [account-closure.md](./account-closure.md) for billing portal and org closure.

**In-dashboard upgrade (Phase J / Option B):** `checkout.session.completed` with `metadata.organization_id` also links Stripe billing to an **existing** free org (Settings → Billing → Upgrade to Standard). Same webhook handler as apex signup.

**Apply PocketBase migrations** after schema changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build --force-recreate pocketbase web
```

---

## 4. Dev bypass (no Stripe keys)

When developing on `localhost` without Stripe credentials, enable:

```bash
NUXT_PUBLIC_STRIPE_DEV_BYPASS=true
```

Then `/pricing` → **Subscribe (dev bypass)** → `/start?checkout=dev_bypass&plan=standard`.

| Rule | Detail |
|------|--------|
| Host | `NUXT_PUBLIC_APP_DOMAIN=localhost` (or dev `import.meta.dev`) |
| Token | Default `dev_bypass` — override with `NUXT_STRIPE_DEV_BYPASS_TOKEN` |
| Production | **Blocked** — bypass never works in production builds |

Free tier always uses `/start?plan=free` (no checkout token). Free includes **1 site / 20 pages per scan**.

**Team trial (no card):** `/start?plan=team&trial=1` provisions `plan=team`, `subscription_status=trialing`, and `trial_ends_at` (+30 days). The scanner lifecycle tick downgrades expired app-managed trials to Free and sends day-7/3/1 nudge emails via PocketBase hooks.

---

## 5. Test cards

Use Stripe [test cards](https://docs.stripe.com/testing) in hosted Checkout:

| Scenario | Card number |
|----------|-------------|
| Success | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |

Any future expiry, any CVC, any billing ZIP.

---

## 6. Docker Compose

Root `.env` vars are passed to the `web` service (see `docker-compose.yml` / `docker-compose.override.yml`). After editing `.env`:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build web
```

---

## 7. End-to-end smoke test (G9)

Use this checklist after env vars, migration, and Docker are in place. Keep **`stripe listen`** running in a second terminal.

### Setup

```bash
# .env (minimum for paid funnel)
NUXT_PUBLIC_MARKETING_SITE=true
NUXT_PUBLIC_SELF_SERVICE_SIGNUP=true
NUXT_PUBLIC_APP_URL=http://localhost:3000
NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NUXT_STRIPE_SECRET_KEY=sk_test_...
NUXT_STRIPE_STANDARD_PRICE_ID=price_...    # not prod_...
NUXT_STRIPE_WEBHOOK_SECRET=whsec_...       # from stripe listen output

docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Free tier path

| # | Step | Expected |
|---|------|----------|
| F1 | Open `http://localhost:3000/` | Marketing landing |
| F2 | `/pricing` → **Get started free** | `/start?plan=free` wizard |
| F3 | Complete wizard | PocketBase `organizations.plan` = **`free`**, `created_via` = `self_service` |
| F4 | Set password + `{subdomain}.localhost:3000/login` | Dashboard loads |

### Standard (paid) path

| # | Step | Expected |
|---|------|----------|
| S1 | `/pricing` → **Subscribe** | Stripe Checkout (test card `4242…`) |
| S2 | After payment | Redirect to `/start?checkout=cs_test_…&plan=standard` |
| S3 | Stripe CLI | `checkout.session.completed` → **200** |
| S4 | PocketBase `stripe_checkout_sessions` | Row `status: paid`, matching `session_id` |
| S5 | Wizard | Work email pre-filled; confirm step shows **Standard** plan |
| S6 | Complete wizard | `organizations.plan` = **`standard`**; checkout row → **`consumed`** |
| S7 | Tenant login | First admin can sign in at subdomain URL |

### Negative checks

| # | Step | Expected |
|---|------|----------|
| N1 | Open `/start` (no query) | Redirect to `/pricing` |
| N2 | Open `/start?plan=standard` (no checkout) | Redirect to `/pricing` |
| N3 | Re-use same `cs_test_…` after org created | Blocked (session consumed) |

### In-dashboard upgrade (free org → Standard)

Requires a tenant on **`plan: free`** with no `stripe_customer_id`. Keep **`stripe listen`** running.

| # | Step | Expected |
|---|------|----------|
| U1 | Sign in as org admin on `{subdomain}.localhost:3000` | Dashboard loads |
| U2 | **Settings → Billing** → **Upgrade to Standard** | Stripe Checkout opens |
| U3 | Pay with `4242…` | Redirect to billing (`checkout=success`) |
| U4 | Stripe CLI | `checkout.session.completed` → **200** |
| U5 | PocketBase `organizations` | Same org: `plan: standard`, `stripe_customer_id` + `stripe_subscription_id` set |
| U6 | Billing page | **Manage billing** visible; upgrade CTA hidden |
| U7 | Retry upgrade on same org | **400** — already has billing / subscription |

API: `POST /api/stripe/create-upgrade-checkout-session` (auth required, admin only).

### Unit tests

```bash
cd apps/web && npm test -- stripe startAccess provisioning
```

---

## 8. Environment reference

| Variable | Service | Required for |
|----------|---------|----------------|
| `NUXT_STRIPE_SECRET_KEY` | web (server) | Checkout + webhooks |
| `NUXT_STRIPE_STANDARD_PRICE_ID` | web (server) | Standard subscription price |
| `NUXT_STRIPE_WEBHOOK_SECRET` | web (server) | Webhook signature (G5) |
| `NUXT_PUBLIC_MARKETING_SITE` | web (public) | Apex landing + `/pricing` |
| `NUXT_PUBLIC_SELF_SERVICE_SIGNUP` | web (public) | `/start` wizard + signup APIs |
| `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web (public) | Optional client integrations |
| `NUXT_PUBLIC_STRIPE_DEV_BYPASS` | web (public) | Local bypass flag (never prod) |
| `NUXT_STRIPE_DEV_BYPASS_TOKEN` | web (server) | Override bypass query token |
| `SCANNER_PURGE_CLOSED_ORGS` | scanner | Enable daily purge of closed orgs past retention |
| `SCANNER_PURGE_TICK_MS` | scanner | Purge tick interval (default 24h) |

---

## 9. Customer Portal (Phase I)

Enable in Stripe Dashboard → **Settings → Billing → Customer portal**. Admins open it from **Settings → Billing** (`POST /api/stripe/create-portal-session`).

Recommended portal permissions for v1:

- Cancel subscription
- Update payment method
- View invoices

See [account-closure.md](./account-closure.md) for org closure and subscription lifecycle.

---

## Related

- [CURRENT_TASK.MD](../CURRENT_TASK.MD) — Phase G status
- [go-live.md](../operations/go-live.md) — production checklist (Stripe live keys)
- [onboarding.md](./onboarding.md) — acquisition paths + self-service signup
