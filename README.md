# SiteNook

Self-hosted accessibility, QA, and SEO monitoring. You run it on your machine with Docker. Crawls use Playwright and axe-core against sites you add. Scan data stays local.

Like Plex: **install is free** (1 site, 20 pages per scan). A **Polar licence key** is meant to unlock full limits. You do not need a SiteNook domain.

**Users do not clone this GitHub repository.** It is private source. You download the app as Docker images, not as git.

---

## For users — install and use

### What you need

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine + Compose (Linux)
- About 8 GB RAM (the scanner runs a real browser)
- Port 80 free (`http://localhost`)

### 1. Get the compose files (not the source)

When images are published, use only the files in [`deploy/community/`](deploy/community/):

- `docker-compose.yml`
- `.env.example`

Copy those two files into a folder on your computer. You never need the rest of this repo.

Until `v0.1.0` images exist on GHCR, `docker compose up` cannot pull `ghcr.io/phatphillips/sitenook-*` yet.

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | What to set |
|----------|-------------|
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | Your admin login for PocketBase |
| `APP_USER_EMAIL` / `APP_USER_PASSWORD` | Dashboard login (first user) |
| `SITENOOK_LICENCE_KEY` | Leave **empty** for Free, or paste the Polar key |
| `SITENOOK_POLAR_ORGANIZATION_ID` | Set by the SiteNook publisher (Polar org UUID). Do not invent one. |

### 3. Start

```bash
docker compose up -d
```

Open **http://localhost** and sign in with `APP_USER_EMAIL` / `APP_USER_PASSWORD`.

First scan:

1. **Sites** → **Add Site** → enter a public URL (e.g. `https://example.com`)
2. **Scan Now**
3. Wait for the crawl, then open **Accessibility** / **QA** / **SEO**

Stop: `docker compose down`. Data stays in the Docker volume `pb_data`.

### 4. Licence (paid)

1. [Buy a Self-host licence on Polar](https://buy.polar.sh/polar_cl_q4q6ftpkyLbwOxv4SDOu2akpXYdFqE7V9RqdE48k67j).
2. Copy the key Polar emails (`AIQ_…`).
3. In the dashboard: **Settings → Billing & Invoices** → paste the key → **Activate**.  
   Or set `SITENOOK_LICENCE_KEY` in `.env` and restart: `docker compose up -d`.

Polar checkout takes cards only after the seller finishes Polar **Finance → Account**. The app checks keys against Polar’s licence API (not a SiteNook cloud). If Polar is unreachable, a previously activated key keeps working until the next successful check.

---

## Is there an API in v1?

**No SiteNook cloud API is required to scan.** The scanner on your machine crawls the site directly.

| API | In v1? | What it is |
|-----|--------|------------|
| Polar licence validate | Yes (paid unlock) | Confirms your key; no scan traffic goes to Polar |
| Local PocketBase (`/api`) | Yes, on your Docker | Dashboard ↔ local database |
| MCP / org API keys | Optional, local | Settings → Integrations — for Cursor on *your* instance |
| Hosted SaaS | **Not v1** | No `sitenook.com` tenant cloud |

You do not create a SiteNook account in the cloud to use the self-hosted app.

---

## For developers (this private repo)

Do not make this git repo public. Customers get images + compose only. Release checklist: [docs/operations/v1-release.md](docs/operations/v1-release.md).

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

- Dashboard: http://localhost:3000
- PocketBase: http://localhost:8090/_/

```bash
cd apps/web && npm test
cd apps/scanner && npm test
```

Docs: [docs/README.md](docs/README.md).

## License

Proprietary. This private repository is not an open-source grant. Upstream Nuxt UI files under `apps/web` keep their MIT notice.
