# SiteNook Community compose

Run SiteNook locally. Application **source stays private**; this folder only pulls images and configures them.

## Quick start

```bash
cp .env.example .env
# Set strong PB_ADMIN_* passwords
docker compose up -d
```

Open http://localhost

- **No licence key** → Free limits (1 site, 20 pages/scan)
- **Paid key** → paste into `SITENOOK_LICENCE_KEY` and restart

Buy a Self-host licence: https://buy.polar.sh/polar_cl_q4q6ftpkyLbwOxv4SDOu2akpXYdFqE7V9RqdE48k67j

Images default to `ghcr.io/phatphillips/sitenook-*` (published from the private monorepo when you tag `v*`).

## Optional search

Typesense is an upstream image (GPL). Off by default:

```bash
# In .env: TYPESENSE_ENABLED=1 and a strong TYPESENSE_API_KEY
docker compose --profile search up -d
```
