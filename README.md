# 🪺 SiteNook

**The free, self-hosted alternative to expensive accessibility tools like SiteImprove.**

Website accessibility matters. Tools that check it shouldn't cost a fortune. SiteNook scans your sites for accessibility, SEO, and quality issues, runs entirely on your own server, and never asks for a monthly invoice.

> ⚠️ **Work in progress.** SiteNook is under active development. Things may break, change, or move. Use it, poke at it, tell us what's wrong.

---

## 🖼️ Screenshots

<!-- Replace these placeholders with real images -->

**[SCREENSHOT]** Dashboard overview

**[SCREENSHOT]** Accessibility issues list

**[SCREENSHOT]** Scan run / crawl progress

---

## 🤔 Why SiteNook?

Good accessibility tools exist. They also charge a lot for something you could run yourself.

SiteNook gives you the same core power for free:

- 🔓 **You own the data.** It lives on your server, not someone else's cloud.
- 💸 **No subscription required.** Self-host it and pay nothing.
- 🛠️ **Build on it.** It's open source, so change it, extend it, connect it to your own tools.
- 🔒 **Runs securely on your own infrastructure.** Nothing leaves your network unless you want it to.

---

## ✨ What it does

One scan, five ways to use it:

- ♿ **Accessibility**. Finds WCAG issues (the industry-standard checks) with a simple 0 to 100 score, so you know what to fix first
- 🔍 **SEO**. Checks the technical and content stuff that helps pages get found
- 🧹 **QA**. Catches broken links, spelling mistakes, and messy content
- 📄 **PDF accessibility**. Checks your PDFs too, not just web pages
- 🗂️ **Content Explorer**. Browse everything your site crawled and export it

A few other things worth knowing:

- ⏰ Scans run automatically on a schedule, or whenever you want
- 👀 A simulator lets you preview pages the way people with vision impairments see them
- 📊 Reports export as PDF or CSV, so you can share results with anyone
- 🐳 Runs in Docker. One command and it's up

---

## 🚀 Quickstart

### What you need

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine + Compose (Linux)
- About 8 GB of RAM (it runs a real browser to scan pages)
- Port **80** free on your machine

### Install

```bash
git clone https://github.com/phatphillips/SiteNook.git
cd SiteNook
cp .env.example .env
```

Copying `.env.example` seeds these defaults (change them before any real deployment):

| Login | Email | Password | Where |
|-------|-------|----------|--------|
| **Dashboard** (first app user) | `admin@sitenook.local` | `changeme_app_password` | http://localhost |
| **PocketBase admin** | `admin@sitenook.local` | `changeme_strong_password_here` | http://localhost:8090/_/ (dev) or via `/_/` behind nginx |

| Variable | What it's for |
|----------|----------------|
| `APP_USER_EMAIL` / `APP_USER_PASSWORD` | Your first login to the dashboard (seeded on first boot) |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | Admin login for the PocketBase database |

Then start the **production** stack (this is the default way to run and test SiteNook):

```bash
# Use -f docker-compose.yml so the optional override file is NOT loaded.
# (A plain `docker compose up` would auto-merge docker-compose.override.yml and run Nuxt in dev mode.)
docker compose -f docker-compose.yml up -d --build
```

Go to **http://localhost** and sign in with the dashboard email/password above (or whatever you set in `.env`).

> First build can take a few minutes. It's compiling the Nuxt production image and downloading a real browser for the scanner.

### Your first scan

1. **Sites** → **Add Site** → enter a public URL
2. Hit **Scan Now**
3. Once it's done, check **Accessibility**, **QA**, or **SEO**

Done scanning for now? `docker compose -f docker-compose.yml down`. Your data stays put in the `pb_data` volume.

### Optional extras

```bash
# Turn on full-text search (Typesense is already included)
# Set TYPESENSE_ENABLED=1 in .env (this is the default)

# Add PDF accessibility checking
docker compose -f docker-compose.yml --profile pdf up -d --build
```

### Production vs development

| Mode | Command | What you get |
|------|---------|--------------|
| **Production (default)** | `docker compose -f docker-compose.yml up -d --build` | Built Nuxt image behind nginx on **http://localhost**. Use this for normal use and for reviewing UI changes. |
| **Development (hot reload)** | `docker compose -f docker-compose.yml -f docker-compose.override.yml up` | Nuxt dev server on **http://localhost:3500**, PocketBase admin on **http://localhost:8090/_/**. Only when you are editing frontend code and want live reload. |

Important: if `docker-compose.override.yml` is present, Docker Compose merges it automatically unless you pass `-f docker-compose.yml` alone. That is why the production commands above always include `-f docker-compose.yml`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run tests and which package manager goes where. More command detail: [docs/operations/commands.md](docs/operations/commands.md).

---

## 🧱 Built with

| Layer | Tech |
|-------|------|
| Dashboard | Vue 3 + Nuxt 4, Nuxt UI |
| Scanner | Node.js, TypeScript, Playwright, axe-core |
| Database | PocketBase |
| Infra | Docker Compose + Nginx |

---

## 📚 More docs

- [CONTRIBUTING.md](CONTRIBUTING.md). Local setup and how to send a PR
- [SECURITY.md](SECURITY.md). How to report a security issue
- [docs/README.md](docs/README.md). Full documentation
- [AGENTS.md](AGENTS.md). Notes for contributors and coding agents

---

## 📄 Licence

SiteNook is released under the [MIT License](LICENSE). Free to use, free to change, free to build on.

Dependencies keep their own licences (MIT, Apache-2.0, MPL-2.0, etc). Typesense Server is GPL-3.0 and is only pulled in as an optional extra. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
