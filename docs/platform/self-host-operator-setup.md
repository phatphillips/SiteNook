# Self-host operator setup (manual)

Steps that require your Stripe / GitHub accounts. Code and CI assume these are done before go-live.

## 1. Prices

Decide and record:

- Self-host monthly price
- Self-host annual price (~15% off recommended)

## 2. Stripe (test mode first)

1. Create product **SiteNook Self-host** with monthly + annual recurring prices.
2. Copy Price IDs into deployment secrets:
   - `NUXT_STRIPE_SELFHOST_PRICE_ID`
   - `NUXT_STRIPE_SELFHOST_ANNUAL_PRICE_ID`
3. Ensure the existing Stripe webhook still points at apex `/api/stripe/webhook`.

## 3. GitHub Container Registry

1. Keep the application monorepo **private**.
2. Allow GitHub Actions to push packages (`packages: write`).
3. When ready to launch, make Community image packages **public**.
4. Optional: create a public `sitenook-compose` repo that only contains the install compose file from `deploy/community/`.

## 4. Secrets

Set on the apex (hosted) deployment:

| Secret | Purpose |
|--------|---------|
| `NUXT_LICENCE_SIGNING_SECRET` | Offline signed tokens |
| `NUXT_LICENCE_ADMIN_KEY` | Admin revoke API |
| `NUXT_STRIPE_SELFHOST_PRICE_ID` | Self-host monthly |
| `NUXT_STRIPE_SELFHOST_ANNUAL_PRICE_ID` | Self-host annual |
| Existing Stripe + SMTP | Checkout + licence email |

## 5. Go-live smoke

1. Fresh VM: `deploy/community` compose → `docker compose up`.
2. No key → Free caps (1 site, 20 pages).
3. Stripe test purchase → paste key → Business caps unlock.
4. Disconnect network → offline grace until signed token expires (7 days).

## Related

- [public-sku-sheet.md](./public-sku-sheet.md)
- [licence-api.md](./licence-api.md)
