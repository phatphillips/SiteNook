# SiteNook — run from published images

Optional path that pulls pre-built images from GHCR (`ghcr.io/phatphillips/sitenook-*`).

For most users, prefer cloning the main repository and running:

```bash
docker compose up -d --build
```

See the root [README.md](../../README.md).

## Requirements

Docker Desktop (or Docker Compose). About 8 GB RAM. Port 80 free.

## Install (images)

Images must already exist on GHCR (published via a `v*` tag on the main repo).

```bash
cp .env.example .env
# Set PB_ADMIN_* and APP_USER_* passwords
docker compose up -d
```

Open http://localhost and sign in with `APP_USER_EMAIL` / `APP_USER_PASSWORD`.

`SITENOOK_COMMERCIAL` defaults to `0` (unlimited OSS). Set to `1` only if you configure Polar/Stripe — see [docs/commercial.md](../../docs/commercial.md).

## Optional search

```bash
# TYPESENSE_ENABLED=1 and a strong TYPESENSE_API_KEY in .env
docker compose --profile search up -d
```
