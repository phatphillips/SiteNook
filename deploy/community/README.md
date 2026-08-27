# SiteNook — run locally

You are **not** downloading the SiteNook source code. These files only start published Docker images on your machine.

## Requirements

Docker Desktop (or Docker Compose). About 8 GB RAM. Port 80 free.

## Install

```bash
cp .env.example .env
# Set PB_ADMIN_* and APP_USER_* passwords
docker compose up -d
```

Open http://localhost and sign in with `APP_USER_EMAIL` / `APP_USER_PASSWORD`.

1. **Sites** → **Add Site**
2. **Scan Now**

Leave `SITENOOK_LICENCE_KEY` empty for Free (1 site, 20 pages/scan).

## Licence

Buy: https://buy.polar.sh/polar_cl_q4q6ftpkyLbwOxv4SDOu2akpXYdFqE7V9RqdE48k67j

Paste the emailed key into `SITENOOK_LICENCE_KEY` and restart. Scanning does **not** use a SiteNook cloud API; crawls run on this machine. Polar is only for the paid key (not wired in the first snapshot).

## Optional search

```bash
# TYPESENSE_ENABLED=1 and a strong TYPESENSE_API_KEY in .env
docker compose --profile search up -d
```
