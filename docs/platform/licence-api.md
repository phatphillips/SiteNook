# Enterprise licence API

Self-hosted Enterprise customers validate licences against the apex AccessIQ deployment.

## Environment

```bash
NUXT_LICENCE_SIGNING_SECRET=...   # HMAC secret for signed offline tokens
NUXT_LICENCE_ADMIN_KEY=...        # Admin key for POST /api/licence/revoke
```

Create licence records in PocketBase admin (`licences` collection) or via superuser API:

| Field | Description |
|-------|-------------|
| `key` | Unique licence key issued to customer |
| `tier` | `enterprise` |
| `domain` | Allowed hostname (optional bind on first validate) |
| `fingerprint` | Set automatically on first validate |
| `expires_at` | Contract expiry date |
| `revoked` | Set `true` to revoke |

## Endpoints

### `POST /api/licence/validate`

```json
{ "key": "...", "domain": "access.example.gov.au", "instance_fingerprint": "..." }
```

Response:

```json
{ "valid": true, "tier": "enterprise", "expires_at": "2027-06-01", "signed_token": "..." }
```

### `POST /api/licence/heartbeat`

```json
{ "signed_token": "..." }
```

Refreshes the offline token (7-day window).

### `POST /api/licence/revoke` (admin)

Header: `X-Licence-Admin-Key: ...`

```json
{ "key": "..." }
```

## Self-hosted boot

Enterprise Docker images should call `validate` on boot and `heartbeat` weekly. Graceful degradation when offline until the signed token expires.
