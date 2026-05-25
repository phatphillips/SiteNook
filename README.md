# AccessIQ

Self-hosted web accessibility and QA monitoring platform — an open-source SiteImprove replacement.

## Architecture

```
Browser → Nginx (port 80)
            ├── /           → Nuxt 3 dashboard (apps/web)
            ├── /api/       → PocketBase REST API
            └── /_/         → PocketBase admin UI

Scanner worker (apps/scanner) polls PocketBase scan_queue and runs Playwright + axe-core crawls.
```

| Service    | Tech                          | Purpose                          |
|------------|-------------------------------|----------------------------------|
| `web`      | Nuxt 3 + Nuxt UI              | Dashboard UI                     |
| `scanner`  | Node.js + Playwright + axe    | WCAG scanning & QA checks        |
| `pocketbase` | PocketBase + SQLite         | Database, auth, realtime API     |
| `nginx`    | Nginx Alpine                  | Reverse proxy                    |

## Quick Start

```bash
cp .env.example .env
# Edit .env — set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD

docker compose up -d --build
```

Open http://localhost for the dashboard.  
PocketBase admin: http://localhost:8090/_/ (dev override exposes port 8090)

### First-time setup

1. Create a user in PocketBase admin (`/_/` → Collections → users → New record)
2. Sign in at http://localhost/login
3. Add a site under **Sites** → **Add Site**
4. Click **Scan Now** to queue a crawl

## Development

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

- Nuxt dev server: http://localhost:3000
- PocketBase: http://localhost:8090
- Hot reload enabled for web and scanner

Or run locally:

```bash
cd apps/web && npm install && npm run dev
cd apps/scanner && npm install && npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PB_ADMIN_EMAIL` | — | PocketBase superuser email |
| `PB_ADMIN_PASSWORD` | — | PocketBase superuser password |
| `NUXT_PUBLIC_POCKETBASE_URL` | `http://pocketbase:8090` | PocketBase URL (internal Docker) |
| `SCANNER_CONCURRENCY` | `3` | Parallel pages per scan |
| `SCANNER_MAX_PAGES` | `500` | Max pages per crawl |
| `SCANNER_POLL_INTERVAL_MS` | `10000` | Queue poll interval |

## Adding a Site

1. Go to **Sites** → **Add Site**
2. Enter name and root URL (e.g. `https://example.com`)
3. Select the site from the sidebar dropdown
4. Click **Scan Now**

## Writing a Custom Policy

1. Go to **Policies** → **New Policy**
2. Choose rule type: **Keyword**, **Regex**, or **HTML Attribute**
3. Set pattern, category, and severity
4. Policies run automatically on the next scan

## Project Structure

```
accessiq/
├── apps/
│   ├── web/          Nuxt 3 dashboard
│   └── scanner/      Playwright + axe-core worker
├── services/
│   └── pocketbase/   PocketBase + schema migrations
├── nginx/            Reverse proxy config
├── docker-compose.yml
└── docker-compose.override.yml
```

## Features

- **Accessibility**: WCAG 2.0/2.1/2.2 A/AA/AAA scanning with axe-core, level toggle, issue filters, detail drawer
- **QA**: Broken link checker, spell checking, content inventory, readability scores
- **Policies**: Custom keyword/regex rules
- **Realtime**: PocketBase SSE updates for scan progress
- **Diff engine**: Compares issues between consecutive scans

## License

MIT
