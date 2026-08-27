# Analytics integrations

Connect third-party web analytics (GA4, Cloudflare, Plausible, Umami, Fathom, Matomo) per SiteNook site from **Settings → Integrations**.

## What ships

- Encrypted credential storage (`analytics_connections`) via AES-256-GCM
- Background Nitro sync ticker writing `analytics_snapshots` (last 28 complete UTC days)
- Team Activity Log events for connect / disconnect / reconnect / needs-reconnect
- Org admins manage connections; viewers can see status only

Dashboard cards that *consume* snapshots are out of scope for this pass.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANALYTICS_CREDENTIALS_ENCRYPTION_KEY` | Yes (to connect) | Base64-encoded 32-byte AES-256 key (`openssl rand -base64 32`) |
| `GA4_OAUTH_CLIENT_ID` | For GA4 | Google OAuth web client ID |
| `GA4_OAUTH_CLIENT_SECRET` | For GA4 | Google OAuth client secret |
| `ANALYTICS_SYNC_ENABLED` | No (default `1`) | Set `0` to disable the sync ticker |
| `ANALYTICS_SYNC_TICK_MS` | No (default `300000`) | Tick interval (min 60s) |

Add the OAuth redirect URI in Google Cloud Console:

`{your-app-origin}/api/analytics/oauth/ga4/callback`

Include tenant subdomain origins if users connect from `*.yourdomain`.

## PocketBase

Migration `1730000055_analytics_integrations.js` creates:

- `analytics_connections` — org + site + provider; server-only writes
- `analytics_snapshots` — normalized metrics cache; server-only writes
- Extended `team_activity_log.action` enum

Apply by restarting PocketBase so migrations run.

## Sync behaviour

- Interval default: 12 hours (`sync_interval_hours`)
- Auth failures → `needs_reconnect` + activity log
- Rate limits → backoff without flipping to needs_reconnect
- Snapshot retention: ~90 days (best-effort purge on sync)

## Adapters

See [`apps/web/server/utils/analytics/providers/README.md`](../../apps/web/server/utils/analytics/providers/README.md) for API docs and metric mapping.
