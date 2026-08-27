# Licence API (Community / Self-host / Enterprise)

Self-hosted appliances validate licences against the apex SiteNook deployment.

## Environment

```bash
NUXT_LICENCE_SIGNING_SECRET=...   # HMAC secret for signed offline tokens
NUXT_LICENCE_ADMIN_KEY=...        # Admin key for POST /api/licence/revoke
```

Create licence records via Stripe Self-host checkout, PocketBase admin (`licences` collection), or superuser API:

| Field | Description |
|-------|-------------|
| `key` | Unique licence key issued to customer |
| `tier` | `community` \| `selfhost` \| `enterprise` |
| `domain` | Allowed hostname (bound on first validate if empty) |
| `fingerprint` | Set automatically on first validate |
| `expires_at` | Contract / subscription expiry |
| `revoked` | Set `true` to revoke |
| `stripe_subscription_id` | Linked Stripe subscription (Self-host) |
| `customer_email` | Purchaser email |
| `stripe_checkout_session_id` | Idempotency for webhook issuance |

## Tier → limits

| Tier | Effective plan | Notes |
|------|----------------|-------|
| `community` (or missing/invalid key) | Free | 1 site / 20 pages |
| `selfhost` | Business | Paid local unlock |
| `enterprise` | Enterprise | Sales / air-gap |

See [public-sku-sheet.md](./public-sku-sheet.md).

## Endpoints

### `POST /api/licence/validate`

```json
{ "key": "...", "domain": "access.example.gov.au", "instance_fingerprint": "..." }
```

Response:

```json
{
  "valid": true,
  "tier": "selfhost",
  "plan": "business",
  "limits": { "maxSites": 25, "maxPagesPerScan": 5000 },
  "expires_at": "2027-06-01",
  "signed_token": "..."
}
```

### `POST /api/licence/heartbeat`

```json
{ "signed_token": "..." }
```

Refreshes the offline token (7-day window). Returns the same `tier` / `plan` / `limits` fields.

### `POST /api/licence/revoke` (admin)

Header: `X-Licence-Admin-Key: ...`

```json
{ "key": "..." }
```

## Appliance boot

Set on Community / Self-host Docker:

```bash
SITENOOK_DEPLOYMENT_MODE=appliance
SITENOOK_LICENCE_KEY=...
SITENOOK_LICENCE_SERVER_URL=https://sitenook.com
SITENOOK_INSTANCE_DOMAIN=access.example.gov.au
SITENOOK_INSTANCE_FINGERPRINT=...   # optional; derived from hostname if unset
```

Call `validate` on boot and `heartbeat` weekly. Graceful degradation when offline until the signed token expires — Community Free caps apply if there is no valid token.

## Related

- [self-host-operator-setup.md](./self-host-operator-setup.md)
- [public-sku-sheet.md](./public-sku-sheet.md)
