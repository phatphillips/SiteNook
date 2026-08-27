# Analytics provider adapters

Research notes and field maps for SiteNook analytics integrations.

Metric mapping rules:
- Never coerce missing values to `0` — use `null`.
- Sync window: last **28 complete UTC days** (excludes today).
- Bounce rates stored as `0–1` when available.

## GA4

- Docs: [Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1), [Admin API accountSummaries](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list)
- Auth: OAuth2 scope `https://www.googleapis.com/auth/analytics.readonly`
- Mapping: `sessions` → sessions, `activeUsers` → visitors, `screenPageViews` → pageviews, `bounceRate` / `engagementRate` as rates
- Property list: Admin API `accountSummaries` → `propertySummaries`

## Cloudflare

- Docs: [GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/)
- Auth: API token (Analytics Read) + Zone ID
- Endpoint: `POST https://api.cloudflare.com/client/v4/graphql`
- Mapping: `httpRequestsAdaptiveGroups.count` → pageviews, `sum.visits` → sessions; unique visitors often unavailable → `null`

## Plausible

- Docs: [Stats API v2](https://plausible.io/docs/stats-api)
- Auth: Bearer API key from **Plausible → Settings → API keys**; optional instance URL for self-hosted (default `https://plausible.io`)
- Endpoint: `POST {instance}/api/v2/query`
- Mapping: `visitors`, `visits` → sessions, `pageviews`, `bounce_rate` (% → 0–1)
- Note: public demo tokens such as `anon-user-test-token` are **not** accepted by Stats API v2 (returns 401). Use a key from your own Plausible account.
- Local connection test without a Plausible account: `node apps/web/scripts/mock-plausible-api.mjs`, then set Instance URL to `http://127.0.0.1:8791` (or `http://host.docker.internal:8791` if the web app runs in Docker).

## Umami

- Docs: [Website statistics](https://umami.is/docs/api/website-stats)
- Auth: Bearer API key; **instance URL required**
- Endpoints: `GET /api/websites/:id/stats`, `/metrics?type=path|referrer`
- Mapping: `visits` → sessions, `visitors`, `pageviews`, bounce = bounces/visits

## Fathom

- Docs: [Fathom API aggregations](https://usefathom.com/docs/api/aggregation) (API base `https://api.usefathom.com/v1`)
- Auth: Bearer API token + site ID
- Mapping: `visits` → sessions, `uniques` → visitors, `pageviews`, `bounce_rate`

## Matomo

- Docs: [Reporting API](https://developer.matomo.org/api-reference/reporting-api)
- Auth: `token_auth` query param; **instance URL required**
- Methods: `VisitsSummary.get`, `Actions.getPageUrls`, `Referrers.getAll`
- Mapping: `nb_visits` → sessions, `nb_uniq_visitors` → visitors, `nb_pageviews` → pageviews
