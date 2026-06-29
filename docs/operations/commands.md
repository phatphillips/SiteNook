# Commands reference

Quick index of useful commands for local development and operations. Run from the **repository root** unless a path is shown.

Related docs: [dev-operations.md](./dev-operations.md) (data reset detail), [CLAUDE.md](../../CLAUDE.md) (agent overview), [stripe-setup.md](../platform/stripe-setup.md) (Stripe).

---

## First-time setup

```powershell
cp .env.example .env
# Edit .env — set PB_ADMIN_*, APP_USER_*, NUXT_PUBLIC_*, Stripe keys as needed

docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

Install dependencies for local (non-Docker) work:

```powershell
cd apps\web
npm install

cd ..\scanner
npm install
```

---

## Docker — run the stack

| Goal | Command |
|------|---------|
| **Dev** (hot reload, ports 3000 / 8090) | `docker compose -f docker-compose.yml -f docker-compose.override.yml up` |
| **Dev detached** | `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d` |
| **Production-style** (nginx on port 80) | `docker compose up -d --build` |
| **Rebuild one service** | `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build --force-recreate pocketbase web` |
| **Rebuild everything** | `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build --force-recreate` |
| **Stop** | `docker compose down` |
| **Logs (web)** | `docker compose logs -f web` |
| **Logs (pocketbase)** | `docker compose logs -f pocketbase` |
| **Logs (scanner)** | `docker compose logs -f scanner` |
| **Shell in scanner container** | `docker compose exec scanner sh` |

After web starts, wait for **`Nuxt Nitro server built`** in logs before opening the app (first build can take ~45–60s).

---

## Local URLs (dev override)

| Service | URL |
|---------|-----|
| Nuxt dashboard | http://localhost:3000 |
| Marketing / apex | http://localhost:3000/ |
| Tenant example | http://{subdomain}.localhost:3000/login |
| PocketBase admin | http://localhost:8090/_/ |
| PocketBase API | http://localhost:8090/api/ |
| Production-style (nginx) | http://localhost |

---

## Web (`apps/web`)

```powershell
cd apps\web

npm run dev          # Nuxt dev server (port 3000)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # ESLint
npm run typecheck    # Nuxt typecheck
npm test             # Unit tests (Vitest)
npm run test:watch   # Unit tests watch mode
npm run test:coverage
npm run test:e2e     # Playwright E2E
npm run test:e2e:ui  # Playwright UI debugger
```

Filter unit tests:

```powershell
npm test -- orgBilling
npm test -- stripe startAccess provisioning
```

---

## Scanner (`apps/scanner`)

```powershell
cd apps\scanner

npm run dev              # Queue worker + scheduler (watch mode)
npm run build            # TypeScript compile → dist/
npm start                # Run compiled worker
npm test                 # Unit tests
npm run test:watch
npm run test:coverage
npm run test:integration # Against test PocketBase :8091
```

### Maintenance scripts

Scripts load **`apps/scanner/.env`** and **repo root `.env`** automatically. Root `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` map to `POCKETBASE_ADMIN_*`.

| Script | Command | Purpose |
|--------|---------|---------|
| **Reset all tenant data** | `npm run reset-dev-tenants -- --confirm` | Delete **all** orgs, users, sites, scans (blank slate). Keeps schema + superuser. |
| **Purge closed orgs** | `npm run purge-closed-orgs` | Delete orgs past 30-day retention (`status: closing`) |
| **Purge one org (dev)** | `npm run purge-closed-orgs -- --org-id=<id> --force` | Skip retention for one closed org |
| **Purge all closing (dev)** | `npm run purge-closed-orgs -- --force` | All `status: closing` orgs immediately |
| **Prune scan retention** | `npm run prune-retention` | Keep detail only on latest completed scan per site |
| **Prune dry run** | `npm run prune-retention -- --dry-run` | Report only, no deletes |
| **Reindex global search** | `npm run reindex-search` | Backfill Typesense from PocketBase (`--site=ID`, `--org=ID`) |

Run via Docker (uses compose env):

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml exec scanner npm run reset-dev-tenants -- --confirm

docker compose -f docker-compose.yml -f docker-compose.override.yml exec scanner npm run purge-closed-orgs -- --org-id=<id> --force
```

**Safety:** `--force` and `reset-dev-tenants` are blocked when `NODE_ENV=production` unless `PURGE_ALLOW_FORCE=true` or `RESET_DEV_ALLOW=true`.

### Nuclear database reset

Wipes the PocketBase volume and re-runs migrations + seed (may recreate Default Organization + `APP_USER_*` from `.env`):

```powershell
docker compose down
docker volume ls
docker volume rm <project>_pb_data
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

---

## Testing

| Scope | Command | Notes |
|-------|---------|-------|
| Web unit | `cd apps\web && npm test` | Vitest |
| Scanner unit | `cd apps\scanner && npm test` | Vitest |
| Scanner integration | `cd apps\scanner && npm run test:integration` | Uses test PB on **8091** — never point at dev **8090** |
| Web E2E | `cd apps\web && npm run test:e2e` | Playwright |
| Web lint + types | `cd apps\web && npm run lint && npm run typecheck` | |

### Test PocketBase (integration)

```powershell
docker compose --profile test up -d pocketbase-test
cd apps\scanner
npm run test:integration
```

Test credentials: `test-admin@accessiq.test` / `test-password-123` (see `AGENTS.md`).

---

## Stripe (local paid signup)

Prerequisites in `.env`: `NUXT_STRIPE_*`, `NUXT_PUBLIC_MARKETING_SITE=true`, `NUXT_PUBLIC_SELF_SERVICE_SIGNUP=true`.

Forward webhooks while testing checkout:

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_…` signing secret to `NUXT_STRIPE_WEBHOOK_SECRET` in `.env`, then restart web.

Full setup: [stripe-setup.md](./stripe-setup.md).

---

## Operator APIs (curl examples)

Replace host, API key, and body values as needed. Dev web on port 3000:

**Provision a new organization** (operator only):

```powershell
curl -X POST http://localhost:3000/api/provision `
  -H "Content-Type: application/json" `
  -H "X-Provision-Key: YOUR_NUXT_PROVISION_API_KEY" `
  -d "{\"orgName\":\"Acme Agency\",\"subdomain\":\"acme\",\"ownerName\":\"Jane Admin\",\"ownerEmail\":\"jane@acme.test\"}"
```

**Check subdomain availability** (public):

```powershell
curl "http://localhost:3000/api/subdomain-available?slug=acme"
```

**Resolve login URL from email** (public):

```powershell
curl "http://localhost:3000/api/org-login-url?email=user@example.com"
```

Self-service signup uses `POST /api/signup-organization` from the `/start` wizard (not curl). See [onboarding.md](../platform/onboarding.md).

---

## Git / GitHub

```powershell
gh pr create --title "..." --body "..."
gh pr checks
gh run list
```

---

## Suggested daily workflows

### Start dev day

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

### Blank tenant data (keep superuser)

```powershell
cd apps\scanner
npm run reset-dev-tenants -- --confirm
```

### After PocketBase migration

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build --force-recreate pocketbase web
```

### Before opening a PR

```powershell
cd apps\scanner
npm test

cd ..\web
npm test
npm run lint
npm run typecheck
```

---

## Environment quick reference

| Variable | Used by |
|----------|---------|
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | PocketBase superuser; mapped to scanner scripts |
| `APP_USER_EMAIL` / `APP_USER_PASSWORD` | Seed user on first boot |
| `NUXT_PUBLIC_POCKETBASE_URL` | Web client PB URL |
| `NUXT_PUBLIC_MARKETING_SITE` | Apex landing at `/` |
| `NUXT_PUBLIC_SELF_SERVICE_SIGNUP` | `/start` wizard |
| `NUXT_PROVISION_API_KEY` | `POST /api/provision` |
| `NUXT_STRIPE_*` | Paid signup + billing webhooks |
| `TYPESENSE_URL` / `TYPESENSE_API_KEY` / `TYPESENSE_ENABLED` | Global search index (web + scanner) |

See `.env.example` for the full list.
