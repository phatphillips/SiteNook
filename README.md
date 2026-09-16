# SiteNook

Self-hosted accessibility, QA, and SEO monitoring for websites you care about.

SiteNook crawls your sites with Playwright and axe-core, stores results in PocketBase on your machine, and shows WCAG issues, broken links, spelling, policies, and scan history in a Nuxt dashboard. You run it with Docker — no SiteNook cloud account required.

**Licence:** [MIT](LICENSE)

---

## Screenshots

<!-- Replace these placeholders with real images -->

**[SCREENSHOT]** Dashboard overview

**[SCREENSHOT]** Accessibility issues list

**[SCREENSHOT]** Scan run / crawl progress

---

## Key features

- **Accessibility** — axe-core WCAG findings with pages, severity, and history
- **QA** — broken links, spelling, inventory
- **SEO** — on-page and crawl-based checks
- **Policies** — custom content rules and matches
- **Scheduled scans** — recurring crawls on a timetable you choose
- **Self-hosted** — data stays in your Docker volume

By default this open-source build runs **without billing caps** (unlimited sites/pages). Optional Stripe / Polar commercial code remains in the tree and can be turned on later — see [docs/commercial.md](docs/commercial.md).

---

## Quickstart

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine + Compose (Linux)
- About 8 GB RAM (the scanner runs a real browser)
- Port **80** free for http://localhost

### Install from this repository

```bash
git clone https://github.com/phatphillips/SiteNook.git
cd SiteNook
cp .env.example .env
```

Edit `.env` and set at least:

| Variable | Purpose |
|----------|---------|
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | PocketBase admin |
| `APP_USER_EMAIL` / `APP_USER_PASSWORD` | First dashboard login |

Then:

```bash
docker compose up -d --build
```

Open **http://localhost** and sign in with `APP_USER_EMAIL` / `APP_USER_PASSWORD`.

> On this repo, `docker-compose.override.yml` is auto-merged for local development (Nuxt also on http://localhost:3500, PocketBase on :8090). To run only the production-style file: `docker compose -f docker-compose.yml up -d --build`.

First scan:

1. **Sites** → **Add Site** → enter a public URL (e.g. `https://example.com`)
2. **Scan Now**
3. Open **Accessibility** / **QA** / **SEO** when the crawl finishes

Stop: `docker compose down`. Scan data stays in the Docker volume `pb_data`.

> First build can take several minutes (scanner image includes Playwright browsers).

### Optional extras

```bash
# Global search (Typesense is already in the default compose stack)
# Set TYPESENSE_ENABLED=1 in .env (default in .env.example)

# PDF accessibility sidecars (veraPDF + OpenDataLoader)
docker compose --profile pdf up -d --build
```

### Hot-reload development

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

- Nuxt: http://localhost:3500
- PocketBase: http://localhost:8090

See [CONTRIBUTING.md](CONTRIBUTING.md) for tests and package managers (`pnpm` for web, `npm` for scanner).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Dashboard | Vue 3 + Nuxt 4, Nuxt UI |
| Scanner | Node.js, TypeScript, Playwright, axe-core |
| Database / API | PocketBase |
| Infra | Docker Compose + Nginx |

---

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — local setup and PRs
- [SECURITY.md](SECURITY.md) — how to report vulnerabilities
- [docs/README.md](docs/README.md) — full documentation index
- [docs/commercial.md](docs/commercial.md) — optional Stripe / Polar commercial module
- [AGENTS.md](AGENTS.md) — architecture notes for contributors and agents

---

## Licence

SiteNook is released under the [MIT License](LICENSE).

Dependencies keep their own licences (MIT, Apache-2.0, MPL-2.0, etc.). Typesense **Server** is GPL-3.0 and is only pulled as an optional Docker image — see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Marketing site (GitHub Pages brochure — not part of the Docker download): https://phatphillips.github.io/SiteNook/

What ships where (OSS app vs github.io vs paid Nuxt landing): [docs/oss-launch-surface.md](docs/oss-launch-surface.md)

Third-party notices: Nuxt UI’s licence lives under `apps/web/LICENSE`. Typesense and veraPDF are optional upstream images; see compose profiles and docs before redistributing binaries.
