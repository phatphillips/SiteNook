# Multi-tenancy — subdomain routing (Phase B)

AccessIQ serves many customer organizations from one Nuxt + PocketBase stack. Each organization has a unique **`subdomain`** slug on the `organizations` collection. Users reach their tenant at:

```text
{subdomain}.{app-domain}
```

Example: `agency-name.accessiq.com` → Default Organization slug `default` in dev → `default.localhost:3000`.

---

## How host → organization resolution works

1. The browser requests a page (e.g. `agency.accessiq.com/login`).
2. Nginx forwards the original `Host` header to the Nuxt server.
3. Nitro route **`GET /api/org-context`** parses the host with `NUXT_PUBLIC_APP_DOMAIN` and looks up the matching `organizations` record (server-side, using PocketBase superuser credentials).
4. The **`tenant` plugin** loads that context into `useTenantOrg()` (`useState('tenant-context')`).
5. **`tenant.global` middleware**:
   - Unknown subdomain → `/account-not-found`
   - Signed-in user on wrong tenant host → clear session → `/login?error=wrong-org`
6. **`login()`** rejects credentials when the user's `organization` does not match the resolved tenant.

Data isolation still comes from PocketBase JWT rules (`@request.auth.organization`). Subdomain routing adds a **UI and login guard** so users land on the correct tenant URL.

---

## Host behaviour

| Host | Mode | Login | Data |
|------|------|-------|------|
| **Apex** (`accessiq.com`, `localhost:3000`) | `apex` | Any org member when `TENANT_ONLY=false`; prod apex → `/sign-in` when `TENANT_ONLY=true` | User's org from JWT |
| **Tenant** (`agency.accessiq.com`) | `tenant` | Only users in that org | Same org via JWT |
| **Unknown subdomain** | `unknown` | Blocked — `/account-not-found` | N/A |

**Dev (`localhost`)** — apex dashboard and login always work, even with `NUXT_PUBLIC_TENANT_ONLY=true`. Local testing uses `default.localhost:3000` for tenant flows.

**Production apex** — set `NUXT_PUBLIC_TENANT_ONLY=true` on the web service. The apex host (`accessiq.com`) shows `/sign-in` instead of the login form or dashboard. Users enter their email on `/sign-in` and are redirected to `{subdomain}.{app-domain}/login`. Allowed apex paths: `/sign-in`, `/signup`, `/start`, `/account-not-found`, `/reset-password`, `/pricing`. Legacy `/find-account` redirects to `/sign-in`.

See [go-live.md](../operations/go-live.md) for the full production checklist.

---

## Environment variables (web / Nitro)

| Variable | Example (Docker prod) | Purpose |
|----------|----------------------|---------|
| `NUXT_PUBLIC_APP_DOMAIN` | `accessiq.com` (prod) / `localhost` (dev) | Base domain for subdomain parsing |
| `NUXT_PUBLIC_APP_URL` | `https://accessiq.com` | Apex link on account-not-found page |
| `NUXT_PUBLIC_TENANT_ONLY` | `true` (prod) / `false` (dev) | Apex → `/sign-in`; localhost apex exempt |
| `NUXT_POCKETBASE_URL` | `http://pocketbase:8090` | Server-side PB URL (not browser `/api`) |
| `NUXT_PB_ADMIN_EMAIL` | Same as `PB_ADMIN_EMAIL` | Superuser lookup for org resolution |
| `NUXT_PB_ADMIN_PASSWORD` | Same as `PB_ADMIN_PASSWORD` | Superuser password |

Browser PocketBase URL remains `NUXT_PUBLIC_POCKETBASE_URL` (`/api` behind nginx).

---

## Local development

| URL | Resolves to |
|-----|-------------|
| `http://localhost:3000` | Apex — default org users work as today |
| `http://default.localhost:3000` | Tenant `default` (seed org subdomain) |

Chrome resolves `*.localhost` to `127.0.0.1` automatically. Set admin credentials on the **web** service so `/api/org-context` can query PocketBase:

```bash
# apps/web/.env or docker-compose.override.yml
NUXT_PUBLIC_APP_DOMAIN=localhost
NUXT_POCKETBASE_URL=http://localhost:8090   # or http://pocketbase:8090 in Docker
NUXT_PB_ADMIN_EMAIL=admin@accessiq.local
NUXT_PB_ADMIN_PASSWORD=your-admin-password
```

Recreate the web container after env changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --force-recreate web
```

---

## Production DNS / Cloudflare (manual)

Configure these on your DNS provider — **not in this repo**:

1. **Apex** `accessiq.com` → your load balancer / Cloudflare Tunnel / server IP.
2. **Wildcard** `*.accessiq.com` → same target (all tenant subdomains hit one Nuxt stack).
3. **Cloudflare Tunnel** (if used): one public hostname route for `accessiq.com` and `*.accessiq.com` → nginx or web upstream.
4. Set `NUXT_PUBLIC_APP_DOMAIN=accessiq.com` on the web service.
5. Ensure nginx passes `Host` through (already configured in `nginx/nginx.conf`).

TLS: use Cloudflare Universal SSL or a wildcard certificate for `*.accessiq.com`.

---

## Verifying two tenants

1. In PocketBase admin, create a second organization (`subdomain: org-b`) and a user assigned to it.
2. Visit `org-b.localhost:3000` (or `org-b.accessiq.com` in prod).
3. Log in as org B user → see only org B sites.
4. Log in as default org user on that host → rejected at login.
5. Visit `unknown.localhost:3000` → `/account-not-found`.

---

## Key files

| File | Role |
|------|------|
| `apps/web/app/utils/subdomain.ts` | Parse `Host` → tenant slug |
| `apps/web/server/api/org-context.get.ts` | Resolve slug → organization |
| `apps/web/server/utils/pbAdmin.ts` | Superuser client for server routes |
| `apps/web/app/composables/useTenantOrg.ts` | Shared tenant context |
| `apps/web/app/plugins/tenant.ts` | Load context on app init |
| `apps/web/app/middleware/tenant.global.ts` | Unknown host + wrong-org + tenant-only apex guards |
| `apps/web/app/pages/find-account.vue` | Legacy redirect → `/sign-in` |
| `apps/web/app/pages/sign-in.vue` | Apex sign-in hub (tenant-only prod) |
| `apps/web/app/utils/tenantOnlyApex.ts` | Tenant-only apex redirect rules |
| `apps/web/app/pages/account-not-found.vue` | Friendly missing-tenant page |
| `apps/web/tests/unit/utils/subdomain.test.ts` | Subdomain parsing tests |
| `apps/web/tests/unit/utils/tenantOnlyApex.test.ts` | Tenant-only apex redirect rules |

---

## Related

- [authentication.md](./authentication.md) — login, JWT, org-scoped API rules
- [users-and-teams.md](./users-and-teams.md) — org roles and team management
- [CURRENT_TASK.MD](../CURRENT_TASK.MD) — Phase C (provisioning) builds on this
- [go-live.md](../operations/go-live.md) — production checklist (email, DNS, tenant-only)
