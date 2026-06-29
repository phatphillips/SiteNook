# Development operations

Day-to-day commands for local Docker dev: resetting data, purging closed orgs, and env var naming.

**Full command index:** [commands.md](./commands.md)

For product flows see [onboarding.md](../platform/onboarding.md), [account-closure.md](../platform/account-closure.md), and [stripe-setup.md](../platform/stripe-setup.md).

---

## Environment variable naming

| Root `.env` | Scanner script (local) | Docker scanner service |
|-------------|------------------------|-------------------------|
| `PB_ADMIN_EMAIL` | Auto-mapped → `POCKETBASE_ADMIN_EMAIL` | `POCKETBASE_ADMIN_EMAIL` (mapped in compose) |
| `PB_ADMIN_PASSWORD` | Auto-mapped → `POCKETBASE_ADMIN_PASSWORD` | `POCKETBASE_ADMIN_PASSWORD` |
| — | `POCKETBASE_URL` (default `http://localhost:8090`) | set in compose |

`npm run purge-closed-orgs` **loads** `apps/scanner/.env` and repo root `.env` automatically (shell env wins if already set). Docker exec still recommended when PocketBase runs in compose.

---

## Purge a closed organization

Default: deletes orgs where **`status = closing`** AND **`purge_scheduled_at` ≤ now**.

### Dev fast path (Phase J — no date backdating)

```powershell
# Purge one closed org immediately (skip 30-day grace)
cd apps\scanner
npm run purge-closed-orgs -- --org-id=u41algm81p7ia02 --force

# Purge ALL orgs in status "closing" immediately
npm run purge-closed-orgs -- --force
```

`--force` is blocked when `NODE_ENV=production` unless `PURGE_ALLOW_FORCE=true`.

### Production-style purge (retention elapsed)

### Run inside Docker

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml exec scanner npm run purge-closed-orgs -- --org-id=u41algm81p7ia02 --force
```

### Run on Windows host (loads root `.env` automatically)

```powershell
cd apps\scanner
npm run purge-closed-orgs -- --org-id=u41algm81p7ia02 --force
```

Ensure PocketBase is up (`http://localhost:8090/_/` loads). If you see `ECONNRESET` or `Waiting for PocketBase`, wait for boot patches to finish or use Docker exec.

### Legacy: backdate `purge_scheduled_at`

You can still set `purge_scheduled_at` to yesterday in PocketBase admin and run without `--force`. Not needed in dev anymore.

### Expected output

```text
Purging closed organizations past retention…
Purged closed organization u41algm81p7ia02 (test-agency)
Done. Organizations purged: 1
```

Verify: org row gone in PocketBase admin; subdomain available via `GET /api/subdomain-available?slug=test-agency`.

---

## Clean slate options (development)

| Goal | Command |
|------|---------|
| Remove **one** closed org (dev) | `npm run purge-closed-orgs -- --org-id=<id> --force` |
| Remove **all** orgs + users + tenant data | `npm run reset-dev-tenants -- --confirm` |
| **Nuclear** — empty database + re-bootstrap from `.env` | See [Nuclear reset](#nuclear-reset) below |

### Reset all tenant data (keeps schema + superuser)

Removes every organization (active or closing), all app `users`, sites, scans, issues, checkout sessions, etc. PocketBase **superuser** login (`PB_ADMIN_*`) is unchanged.

```powershell
cd apps\scanner
npm run reset-dev-tenants -- --confirm
```

Docker:

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml exec scanner npm run reset-dev-tenants -- --confirm
```

Blocked when `NODE_ENV=production` unless `RESET_DEV_ALLOW=true`.

After this, the `users` and `organizations` collections in PocketBase admin should be **empty**. You can create a fresh org via `/start` or `POST /api/provision`.

### Nuclear reset

Destroys the entire PocketBase SQLite database and re-runs migrations + seed (recreates **Default Organization** and `APP_USER_*` from `.env` if set):

```powershell
docker compose down
docker volume ls   # find volume named *pb_data*
docker volume rm <volume_name>
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

---

## Rebuild after schema changes

```powershell
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build --force-recreate pocketbase web
```

Wait for PocketBase patches to finish and Nitro: `Nuxt Nitro server built` in web logs before opening `http://localhost:3000/`.

---

## Test commands

| Scope | Command |
|-------|---------|
| Web unit | `cd apps/web && npm test` |
| Scanner unit | `cd apps/scanner && npm test` |
| Scanner integration | `cd apps/scanner && npm run test:integration` |
| Web E2E | `cd apps/web && npm run test:e2e` |
