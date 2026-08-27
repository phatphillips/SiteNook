# SiteNook

Self-hosted web accessibility, QA, and SEO monitoring. Crawl sites with Playwright and axe-core. Data stays on the machine that runs Docker.

**This repository is private.** It is the product source (Plex model): users can self-host the app; full limits require a paid Polar licence. Do not make this git repo public.

v1 path: [docs/operations/v1-release.md](docs/operations/v1-release.md).

## How v1 ships

| Who | What they use |
|-----|----------------|
| You (development) | This repo + `docker compose` with build contexts |
| Customers | Pre-built images + [`deploy/community/`](deploy/community/) compose — **no source** |
| Free | No licence key → 1 site, 20 pages per scan |
| Paid | Polar licence key → higher site/page caps and paid modules |

Buy link (Polar): https://buy.polar.sh/polar_cl_q4q6ftpkyLbwOxv4SDOu2akpXYdFqE7V9RqdE48k67j

Checkout stays blocked until Polar **Finance → Account** (payout + identity) is complete.

## Architecture

```
Browser → Nginx (port 80)
            ├── /           → Nuxt dashboard (apps/web)
            ├── /api/       → PocketBase REST API
            └── /_/         → PocketBase admin UI

Scanner worker (apps/scanner) polls scan_queue and runs Playwright + axe-core crawls.
```

| Service | Tech | Purpose |
|---------|------|---------|
| `web` | Nuxt 4 + Nuxt UI | Dashboard |
| `scanner` | Node.js + Playwright + axe | WCAG, QA, SEO |
| `pocketbase` | PocketBase + SQLite | DB, auth, realtime |
| `nginx` | Nginx Alpine | Reverse proxy |

## Development

```bash
cp .env.example .env
# Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD

docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

- Nuxt: http://localhost:3000
- PocketBase: http://localhost:8090/_/

```bash
cd apps/web && npm install && npm run dev
cd apps/scanner && npm install && npm run dev
```

### First local scan

1. Create a user in PocketBase admin (`/_/` → users) or use seeded `APP_USER_*`.
2. Sign in at http://localhost:3000/login
3. **Sites** → **Add Site** → **Scan Now**

## Customer install (after images are published)

From [`deploy/community/`](deploy/community/):

```bash
cp .env.example .env
docker compose up -d
```

Open http://localhost. Leave `SITENOOK_LICENCE_KEY` empty for Free caps.

## Tests

| Scope | Command |
|-------|---------|
| Web unit | `cd apps/web && npm test` |
| Scanner unit | `cd apps/scanner && npm test` |
| Scanner integration | `cd apps/scanner && npm run test:integration` |
| Web E2E | `cd apps/web && npm run test:e2e` |

Docs index: [docs/README.md](docs/README.md). Agent notes: [AGENTS.md](AGENTS.md).

## License

Proprietary. Source in this private repo is not an open-source grant. Nuxt UI template files under `apps/web` retain their upstream MIT notice.
