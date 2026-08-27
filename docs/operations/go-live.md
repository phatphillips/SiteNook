# Go live — production checklist

Use this checklist when moving SiteNook from local/dev to a real customer-facing deployment. It ties together email deliverability (E2), apex vs tenant routing (E3), and DNS (E4).

For day-to-day development, keep `NUXT_PUBLIC_TENANT_ONLY` unset and use apex `localhost:3000` as today.

---

## Before you start

| Item | Doc |
|------|-----|
| Multi-tenant data model and org provisioning | [onboarding.md](../platform/onboarding.md) |
| Subdomain routing and host behaviour | [multi-tenancy.md](../platform/multi-tenancy.md) |
| Users, roles, team invites | [users-and-teams.md](../platform/users-and-teams.md) |
| Auth, JWT, collection rules | [authentication.md](../platform/authentication.md) |
| Phase tracking | [CURRENT_TASK.MD](../CURRENT_TASK.MD) |

---

## 1. DNS and TLS (E4)

Configure on your DNS provider (e.g. Cloudflare) — **not in this repo**:

- [ ] **Apex** `sitenook.com` → load balancer / tunnel / server IP
- [ ] **Wildcard** `*.sitenook.com` → same target (all tenant subdomains)
- [ ] TLS: Cloudflare Universal SSL or wildcard cert for `*.sitenook.com`
- [ ] Nginx passes `Host` through (already in `nginx/nginx.conf`)

Set on the **web** service:

```bash
NUXT_PUBLIC_APP_DOMAIN=sitenook.com
NUXT_PUBLIC_APP_URL=https://sitenook.com
```

Details: [multi-tenancy.md](../platform/multi-tenancy.md) § Production DNS / Cloudflare.

---

## 2. Email deliverability (E2)

Invites and password resets are sent by **PocketBase over SMTP**. Dev Gmail often lands in spam; production needs a verified domain.

- [ ] Choose a transactional provider (**Resend** recommended, or SendGrid)
- [ ] Verify sending domain; add **SPF**, **DKIM**, **DMARC** DNS records from the provider UI
- [ ] PocketBase `/_/ → Settings → Mail settings` — SMTP + `From: SiteNook <noreply@yourdomain.com>`
- [ ] Align `APP_DASHBOARD_URL` and `APP_PUBLIC_DOMAIN` on the **pocketbase** service with production URLs
- [ ] **Send test email** from PocketBase → arrives in **inbox** (not spam)
- [ ] Provision or invite a test user → set-password link opens `{subdomain}.sitenook.com/reset-password`

Full setup: [onboarding.md](../platform/onboarding.md) § Email deliverability.

---

## 3. Apex → tenant-only dashboard (E3)

In production, the **apex** host (`sitenook.com`) should not serve the dashboard or login form. Users sign in at `{subdomain}.sitenook.com`.

On the **web** service:

```bash
NUXT_PUBLIC_TENANT_ONLY=true
```

| Host | `TENANT_ONLY=false` (dev) | `TENANT_ONLY=true` (prod) |
|------|----------------------------|---------------------------|
| `localhost:3000` | Full dashboard + login | Full dashboard + login (dev unchanged) |
| `sitenook.com` | Dashboard + login (legacy) | `/sign-in` only — no apex login |
| `agency.sitenook.com` | Tenant login + dashboard | Tenant login + dashboard |

Apex paths still allowed when tenant-only: `/sign-in`, `/signup`, `/start`, `/account-not-found`, `/reset-password`, `/pricing`. Legacy `/find-account` redirects to `/sign-in`.

Details: [multi-tenancy.md](../platform/multi-tenancy.md) § Host behaviour.

---

## 4. Environment variables (production summary)

| Variable | Service | Production example |
|----------|---------|-------------------|
| `NUXT_PUBLIC_APP_DOMAIN` | web | `sitenook.com` |
| `NUXT_PUBLIC_APP_URL` | web | `https://sitenook.com` |
| `NUXT_PUBLIC_POCKETBASE_URL` | web | `/api` |
| `NUXT_PUBLIC_TENANT_ONLY` | web | `true` |
| `NUXT_PUBLIC_SELF_SERVICE_SIGNUP` | web | `false` until ready, then `true` |
| `NUXT_PUBLIC_TURNSTILE_SITE_KEY` / `NUXT_TURNSTILE_SECRET` | web | Cloudflare Turnstile (recommended with self-service) |
| `NUXT_PROVISION_API_KEY` | web | Strong secret (server only) |
| `NUXT_PB_ADMIN_*` | web | PocketBase superuser |
| `APP_DASHBOARD_URL` | pocketbase | `https://sitenook.com` |
| `APP_PUBLIC_DOMAIN` | pocketbase | `sitenook.com` (from compose: `NUXT_PUBLIC_APP_DOMAIN`) |
| PocketBase SMTP | pocketbase admin | Resend / SendGrid on verified domain |
| `PB_ADMIN_*` | pocketbase, scanner | Change from `.env.example` defaults |

Copy from [.env.example](../.env.example) and [apps/web/.env.example](../apps/web/.env.example). **Never commit `.env`.**

---

## 5. Deploy and smoke test

```bash
docker compose up -d --build
# or with dev override omitted for production images
```

| # | Check |
|---|--------|
| 1 | `https://sitenook.com` → **Find your organization** (not login form) |
| 2 | `https://default.sitenook.com/login` (or a real tenant subdomain) → login works |
| 3 | Wrong-org user on tenant host → blocked at login |
| 4 | `https://unknown.sitenook.com` → `/account-not-found` |
| 5 | `POST /api/provision` → first admin email in **inbox** |
| 6 | Admin invites colleague → email + tenant reset link + activity log |
| 7 | Scanner processes `scan_queue` against customer sites |

Manual onboarding checklist: [onboarding.md](../platform/onboarding.md) § Manual verification checklist.

---

## 6. Self-service + marketing signup (Phase F + G)

After E2 inbox delivery and E4 DNS are verified:

```bash
NUXT_PUBLIC_MARKETING_SITE=true
NUXT_PUBLIC_SELF_SERVICE_SIGNUP=true
NUXT_PUBLIC_TURNSTILE_SITE_KEY=...   # recommended
NUXT_TURNSTILE_SECRET=...
NUXT_PUBLIC_TERMS_URL=https://sitenook.com/terms
```

| # | Check |
|---|--------|
| 1 | `https://sitenook.com/` — marketing landing (when `MARKETING_SITE=true`) |
| 2 | `/pricing` — free + paid plan CTAs work |
| 3 | Free path → `/start?plan=free` → org with `plan: free` |
| 4 | Paid path → Stripe Checkout → wizard → org with `plan: starter`, `team`, or `business` |
| 5 | Set-password email in **inbox**; tenant login works |
| 6 | Team invite flow unchanged |

Full smoke checklist: [stripe-setup.md](../platform/stripe-setup.md) § End-to-end smoke test.

Keep `NUXT_PROVISION_API_KEY` for operator provisioning. Details: [onboarding.md](../platform/onboarding.md) § Self-service organization signup.

---

## 7. Stripe paid onboarding (Phase G)

Production Stripe (live mode):

| Variable | Production |
|----------|------------|
| `NUXT_STRIPE_SECRET_KEY` | `sk_live_…` |
| `NUXT_STRIPE_TEAM_PRICE_ID` | Live `price_…` (Team tier; or legacy `NUXT_STRIPE_STANDARD_PRICE_ID`) |
| `NUXT_STRIPE_STARTER_PRICE_ID` / `NUXT_STRIPE_BUSINESS_PRICE_ID` | Live `price_…` for other tiers |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Dashboard webhook signing secret (not CLI) |
| `NUXT_PUBLIC_STRIPE_DEV_BYPASS` | **`false`** |

Configure a **live** webhook endpoint in Stripe Dashboard → `https://sitenook.com/api/stripe/webhook` for `checkout.session.completed`.

Setup guide: [stripe-setup.md](../platform/stripe-setup.md).

---

## 8. Pre-launch quality & hardening

Run these before opening to customers (dev-only checks; not blocking day-to-day development):

| Item | Command / notes |
|------|-----------------|
| Viewer read-only E2E | `cd apps/web && npm run test:e2e` — viewer cannot mutate data |
| Second-tenant smoke | Provision `org-b.localhost:3000`; confirm tenant isolation and wrong-org login block |
| Paid closure + portal E2E | Stripe test mode: signup → portal cancel → webhook → retention; see [account-closure.md](../platform/account-closure.md) |
| In-dashboard upgrade smoke | Free tenant → Settings → Billing → Upgrade; see [stripe-setup.md](../platform/stripe-setup.md) § In-dashboard upgrade |
| Scanner integration | `cd apps/scanner && npm run test:integration` |
| Web + scanner unit tests | `cd apps/web && npm test` · `cd apps/scanner && npm test` |

---

## 9. Security reminders

- Change all `changeme_*` passwords and provision API key
- Restrict PocketBase admin (`/_/`) to operators (VPN, IP allowlist, or separate host)
- Keep `NUXT_PROVISION_API_KEY` server-side only
- Review PocketBase collection rules after upgrades (`patch-rules.sh` on boot)

---

## Related

- [onboarding.md](../platform/onboarding.md) — provisioning and invites
- [multi-tenancy.md](../platform/multi-tenancy.md) — subdomain routing
- [CURRENT_TASK.MD](../CURRENT_TASK.MD) — active development tasks (Phase J)
