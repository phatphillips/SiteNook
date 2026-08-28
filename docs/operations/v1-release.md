# v1 release path (Plex model)

This private repo is the **source of truth**. Customers never clone it. They run Docker images and optionally buy a Polar licence key.

## What v1 is

| Piece | v1 |
|-------|----|
| Product | Self-host accessibility / QA / SEO scanner |
| Install | Docker Compose (`deploy/community/`) |
| Free | No key → 1 site, 20 pages/scan |
| Paid | Polar licence key → Business local limits |
| Source | Stays in this **private** GitHub repo |
| Domain | None required |

Hosted SaaS is **not** v1. Polar is the only external API (licence check). Crawls stay local.

## Code that is done

- Polar licence validate (scanner + dashboard)
- Settings → Billing: paste key / buy link
- Banner → Settings (not `/download`)
- New orgs seeded as `free`
- Community compose env for Polar org ID + checkout URL

## What you do before customers can install

1. **Polar Finance → Account** — payout + identity so checkout accepts cards.
2. **Copy Polar Organization ID** (Polar → Settings) into `deploy/community/.env.example` as `SITENOOK_POLAR_ORGANIZATION_ID=…` so every customer install can validate keys.
3. **Tag `v0.1.0`** on `phatphillips/SiteNook` — GitHub Actions publishes `ghcr.io/phatphillips/sitenook-*`.
4. **Make those GHCR packages public** (images only). Keep this git repo private.
5. **Smoke** on a clean Docker machine: no key = Free; Polar key = unlock.

PDF is **not** in community compose. Do not advertise PDF on v1.

## This repo vs public artifacts

| Artifact | Visibility |
|----------|------------|
| `github.com/phatphillips/SiteNook` | **Private** — full source |
| GHCR `sitenook-*` images | Public when you are ready to ship |
| `deploy/community/` compose | Safe to copy into a public compose-only repo |
