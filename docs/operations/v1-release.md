# v1 release path (Plex model)

This private repo is the **source of truth**. Customers never clone it. They run Docker images and optionally buy a Polar licence key.

## What v1 is

| Piece | v1 |
|-------|----|
| Product | Self-host accessibility / QA / SEO scanner |
| Install | Docker Compose (`deploy/community/`) |
| Free | No key → 1 site, 20 pages/scan |
| Paid | Polar licence key → Business-level local limits |
| Source | Stays in this **private** GitHub repo |
| Domain | None required |

Hosted SaaS (subdomains, `/start`, cloud Stripe) is **not** v1.

## What customers get

1. Compose file + `.env.example` (this folder, or a later public `sitenook-compose` repo with **no app source**).
2. Images from GHCR: `ghcr.io/phatphillips/sitenook-{web,scanner,pocketbase,nginx}`.
3. Polar checkout for a key: https://buy.polar.sh/polar_cl_q4q6ftpkyLbwOxv4SDOu2akpXYdFqE7V9RqdE48k67j

## Remaining work before a public install

Do these in order. Source can already live on `phatphillips/SiteNook`.

1. **Polar Finance → Account** — payout + identity so checkout accepts cards (today: “Payments are currently unavailable”).
2. **Wire licence keys** — appliance validates a Polar key (or a signed local key). Until then a pasted key does nothing and Free caps stay on. See [licence-api.md](../platform/licence-api.md).
3. **In-app paste key** — Settings field; banner “Buy licence” → Polar URL. Do not send users to a hosted `/download` site.
4. **Seed Free** — appliance org plan `free`, not `standard` / Team.
5. **Tag `v0.1.0`** on this private repo — `.github/workflows/publish-ghcr.yml` builds images.
6. **GHCR packages public** (images only, not this git repo).
7. **Smoke** on a clean Docker machine: no key = Free caps; Polar key = unlock.

PDF (VeraPDF / OpenDataLoader) is **not** in community compose. Do not advertise PDF on v1 Self-host.

## This repo vs public artifacts

| Artifact | Visibility |
|----------|------------|
| `github.com/phatphillips/SiteNook` | **Private** — full source |
| GHCR `sitenook-*` images | Public when you are ready to ship |
| `deploy/community/` compose | Safe to copy into a public compose-only repo |

## Dev (you)

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

Dashboard: http://localhost:3000 · PocketBase: http://localhost:8090
