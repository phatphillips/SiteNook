# Contributing to SiteNook

Thanks for helping improve SiteNook. This guide covers a practical local setup.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose)
- Node.js 22+ (for running tests outside Docker)
- About 8 GB RAM for the scanner (Playwright)

## Quick local stack

```bash
cp .env.example .env
# Set PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, APP_USER_EMAIL, APP_USER_PASSWORD
docker compose up -d --build
```

- Dashboard (nginx): http://localhost
- PocketBase admin (with override): http://localhost:8090/_/

Hot reload (dev override):

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

- Nuxt: http://localhost:3500
- PocketBase: http://localhost:8090

Optional PDF sidecars: `docker compose --profile pdf up -d`.

## Package managers

| App | Tool |
|-----|------|
| `apps/web` | **pnpm** (`packageManager` in package.json) |
| `apps/scanner` | **npm** |

```bash
cd apps/web && pnpm install && pnpm test && pnpm run lint && pnpm run typecheck
cd apps/scanner && npm install && npm test
```

## Project layout

| Path | Purpose |
|------|---------|
| `apps/web/` | Nuxt 4 dashboard |
| `apps/scanner/` | Playwright + axe-core worker |
| `services/pocketbase/` | PocketBase image + migrations + hooks |
| `deploy/community/` | Pre-built image compose (GHCR) |
| `docs/commercial.md` | How to re-enable Stripe / Polar |

## Pull requests

1. Keep diffs focused; avoid drive-by refactors.
2. Add or update unit tests for behaviour you change.
3. Do not commit `.env`, secrets, or `pb_data/`.
4. Schema changes go in `services/pocketbase/pb_migrations/`, not manual DB edits.

## Code of conduct

Be respectful in issues and PRs. Maintainers may close hostile or off-topic discussion.
