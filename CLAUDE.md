# CLAUDE.md — Agent Instructions

## Project Overview

AccessIQ is a self-hosted web accessibility and QA monitoring platform (an open-source SiteImprove-style replacement). It crawls registered sites with Playwright and axe-core, stores results in PocketBase, and exposes a Nuxt dashboard for WCAG issues, broken links, spelling, policies, and scan management.

## Stack

- Frontend: Vue / Nuxt 4 (`nuxt` ^4.4.6 in `apps/web/package.json`)
- Backend: PocketBase 0.25.8 (pinned in `services/pocketbase/Dockerfile`)
- Infrastructure: Docker Compose
- Runtime: Node.js >=18 (`package.json` engines at repo root; scanner uses TypeScript 5.7)

## Project Structure

| Path | Purpose |
|------|---------|
| `apps/web/` | Nuxt 4 + Nuxt UI dashboard (`app/` pages, composables, components; `server/api/` Nitro routes) |
| `apps/scanner/` | Node/TypeScript worker: polls `scan_queue`, runs Playwright + axe-core crawls and QA checks |
| `services/pocketbase/` | PocketBase Docker image, bootstrap scripts, and `pb_migrations/` schema |
| `nginx/` | Reverse proxy: `/` → web, `/api/` and `/_/` → PocketBase |
| `docker-compose.yml` | Production-style stack: nginx, web, scanner, pocketbase |
| `docker-compose.override.yml` | Dev overrides: hot reload, exposed ports 3000/8090 |
| `docs/archive/` | Archived planning docs (e.g. [project-brief.md](docs/archive/project-brief.md)) |
| `docs/README.md` | Documentation index and naming conventions |

## Key Conventions

- **Nuxt app layout**: `apps/web/app/` uses Nuxt 4 directory structure — `pages/`, `components/`, `composables/`, `middleware/`, `plugins/`, `utils/`, `types/`.
- **Data access**: Frontend uses the `pocketbase` JS SDK via `usePocketBase()` (`app/composables/usePocketBase.ts`) and `plugins/pocketbase.client.ts`; composables like `useSites`, `useScanQueue`, `useAccessibility` wrap collection calls.
- **Auth**: PocketBase `users` collection with `authWithPassword`; route guard in `app/middleware/auth.ts`; shared auth state via VueUse `createSharedComposable`.
- **Scanner**: TypeScript ESM under `apps/scanner/src/`; queue processor in `index.ts` calls `parseRawConfig`, `createAuthenticatedContext`, and QA modules.
- **Schema**: PocketBase collections defined as versioned JS migrations in `services/pocketbase/pb_migrations/` (sites, scans, pages, issues, qa_results, policies, scan_queue, etc.).
- **Package managers**: `apps/web` declares `pnpm`; Docker dev images use `npm` — match the tool used in the target directory.

## How to Run

```bash
cp .env.example .env
# Set PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, and related vars

docker compose up -d --build
```

Dashboard: http://localhost  
PocketBase admin (with override): http://localhost:8090/_/

**Development (hot reload):**

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

- Nuxt dev: http://localhost:3000  
- PocketBase: http://localhost:8090  

**Local without Docker:**

```bash
cd apps/web && npm install && npm run dev
cd apps/scanner && npm install && npm run dev
```

## How to Build

```bash
# Web (Nuxt production build)
cd apps/web && npm run build

# Scanner (TypeScript compile)
cd apps/scanner && npm run build

# Full stack images
docker compose build
```

## How to Test

No project-level test scripts in `apps/web` or `apps/scanner` package.json. Root legacy package exposes `npm run test-browser` (`node test.cjs`). Lint/typecheck for web:

```bash
cd apps/web && npm run lint && npm run typecheck
```

Otherwise: **no automated test suite found** for the AccessIQ apps.

## PocketBase Notes

- Collections and schema live in: `services/pocketbase/pb_migrations/` (applied on container start; runtime SQLite in Docker volume `pb_data` mounted at `/pb/pb_data`)
- Auth patterns used: PocketBase built-in `users` auth; web app `authWithPassword` / signup; API rules require `@request.auth.id != ""` on collections; scanner uses admin credentials (`POCKETBASE_ADMIN_EMAIL` / `POCKETBASE_ADMIN_PASSWORD`) from env
- Custom PocketBase hooks or extensions: **none** — no `pb_hooks/` directory; bootstrap via `entrypoint.sh`, `bootstrap.sh`, `seed.sh`, `patch-users.sh`, `patch-rules.sh`

## Docker Notes

- Services defined: `nginx`, `web`, `scanner`, `pocketbase` (volume `pb_data`)
- Key environment variables required (from `.env.example`):
  - `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`
  - `APP_USER_EMAIL`, `APP_USER_PASSWORD`
  - `NUXT_PUBLIC_POCKETBASE_URL`, `NUXT_PUBLIC_APP_URL`
  - `SCANNER_CONCURRENCY`, `SCANNER_MAX_PAGES`, `SCANNER_POLL_INTERVAL_MS`

## Things to Avoid

- Do not modify `pb_data/` directly (use PocketBase admin or migrations)
- Do not commit `.env` files
- Do not commit `graphify-out/manifest.json` or `graphify-out/cost.json`
- Do not treat `apps/web/.output/` or `apps/web/.nuxt/` as source — regenerate via build
- Avoid editing production data in running containers without migrations
- Do not reintroduce pre-monorepo `frontend/`, `backend/`, or root WordPress auditor scripts

## Context Files for Agents

For a full onboarding brief in a new chat, attach **`@AGENTS.md`**.

When answering questions about this codebase, prefer reading these files first:

- CLAUDE.md (this file)
- AGENTS.md (on-demand project intro for new agent chats)
- docs/README.md (documentation index)
- docs/platform-status.md (shipped features and known gaps)
- graphify-out/GRAPH_REPORT.md (architecture map)
- docker-compose.yml (infrastructure)
- package.json (dependencies and scripts)

## Testing

### Run all unit tests
From root (if workspaces configured): npm test
Scanner only: cd apps/scanner && npm test
Web only: cd apps/web && npm test

### Run E2E tests (Playwright)
cd apps/web && npm run test:e2e
cd apps/web && npm run test:e2e:ui   # visual debugger

### Run integration tests (scanner vs test PocketBase)
npm run test:integration
# Starts test PocketBase on port 8091, runs tests, tears down

### Test environment rules
- Test PocketBase: port 8091 (Docker profile: test), uses same build as prod
- Dev PocketBase: port 8090 — NEVER point tests at this
- Test admin credentials: test-admin@accessiq.test / test-password-123
- Test user credentials: test-user@accessiq.test / test-user-password-123
- Fixtures live in: tests/fixtures/pb_data/
- Test results: apps/web/tests/results/ (gitignored)

### Key units to test when changing scanner logic
- parseRawConfig() → apps/scanner/tests/unit/config/
- matchesExclude/Include() → apps/scanner/tests/unit/crawler/
- axe utilities + scoring → apps/scanner/tests/unit/accessibility/
- diffScans() → apps/scanner/tests/unit/accessibility/diffScans.test.ts
- spell checker → apps/scanner/tests/unit/qa/

### Key units to test when changing frontend
- useSites, useScanQueueStatus stores → apps/web/tests/unit/stores/
- Auth and site list flows → apps/web/tests/e2e/

### For agents running tests
1. Run unit tests first — fastest signal: cd apps/scanner && npm test
2. For scanner logic changes, also run: npm run test:integration
3. For UI or auth changes, run: cd apps/web && npm run test:e2e
4. Read apps/web/tests/results/e2e-results.json for structured pass/fail
5. If integration tests hang, check container: docker compose --profile test ps
