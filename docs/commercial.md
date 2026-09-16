# Commercial module (optional)

SiteNook’s **open-source default** runs without Stripe, Polar, or signed licence checks. Plan caps are treated as **enterprise** (unlimited sites/pages/features).

## OSS vs paid marketing

Public discovery is **GitHub Pages** (`website/` → `phatphillips.github.io/SiteNook`), not the Nuxt app.

The Nuxt marketing landing (`MarketingLandingPage`, `/pricing`, trials) is the **paid hosted apex**. It only activates when both `SITENOOK_COMMERCIAL=1` and `NUXT_PUBLIC_MARKETING_SITE=true`. See [oss-launch-surface.md](./oss-launch-surface.md).

## Toggle

| Value | Behaviour |
|-------|-----------|
| unset / `0` / `false` (default) | OSS core — no billing APIs, no upgrade banners, unlimited |
| `1` / `true` / `on` | Commercial — Stripe Billing, Polar appliance keys, Free caps, signed licences |

Set in `.env` and compose:

```bash
SITENOOK_COMMERCIAL=1
```

Pass the same variable to **web**, **scanner**, and **pocketbase** services so UI, crawl clamps, and PocketBase hooks stay aligned.

## What stays in the tree

Commercial code is **not deleted**. It lives on disk and activates when the flag is on:

| Area | Paths |
|------|--------|
| Stripe | `apps/web/server/api/stripe/*`, `apps/web/server/utils/stripe*`, Settings billing UI |
| Billing APIs | `apps/web/server/api/billing/*` |
| Signed licences | `apps/web/server/api/licence/validate|heartbeat|revoke`, `licenceTokens.ts`, `licenceIssuance.ts` |
| Polar / appliance | `apps/web/server/utils/polarLicence.ts`, `apps/scanner/src/licence/*`, `ApplianceLicencePanel.vue` |
| Caps | `planLimits.ts`, `pb_hooks/plan_limits_*.js`, scanner `processQueueItem` clamp |

Gate helpers:

- `apps/web/server/utils/commercial.ts`
- `apps/web/app/utils/commercial.ts`
- `apps/scanner/src/config/commercial.ts`
- `apps/web/server/middleware/commercial.ts` (404s commercial APIs when off)

## Re-enable checklist

1. Set `SITENOOK_COMMERCIAL=1` on web, scanner, and pocketbase.
2. Configure Stripe keys / price IDs (hosted SaaS) and/or Polar org ID + appliance mode (self-host).
3. Restart containers. New orgs may still need `plan: free` for Community-style caps; existing OSS seeds use `enterprise`.

## OSS seed

With commercial off, `seed.sh` creates the default organization with `plan: "enterprise"` so PocketBase hooks and the scanner do not apply Free limits.
