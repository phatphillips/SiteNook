# Public SKU sheet

Dual-track offering: hosted SaaS plus closed-source Community / Self-host Docker.

| SKU | Limits | Money | How customers get it |
|-----|--------|-------|----------------------|
| **Hosted Free** | 1 site / 20 pages per scan | $0 | `/pricing` → `/start?plan=free` |
| **Hosted Starter / Team / Business** | Existing plan limits | Existing Stripe | `/pricing` → Stripe Checkout |
| **Community (local)** | Same as Free | $0 | Public Docker Compose; optional free licence key |
| **Self-host licence** | Mirrors **Business** plan limits locally | Monthly / annual Stripe | Licence key unlocks appliance |
| **Enterprise (self-host)** | Custom / air-gap | Sales | Private image + enterprise licence |

## Locked product decisions

- Self-host unlocked limits = **Business** (policies, inventory, PDF, 25 sites, 5 000 pages/scan).
- Community / unlicensed appliance keeps running forever at Free caps (no hard brick).
- Paid Self-host key = full local limits + image updates + email support.
- Typesense is an **optional upstream** dependency in public compose (`TYPESENSE_ENABLED=0` by default). SiteNook images do not vendor Typesense binaries.

## Operator checklist (manual)

See [self-host-operator-setup.md](./self-host-operator-setup.md).

## Related

- [licence-api.md](./licence-api.md)
- [stripe-setup.md](./stripe-setup.md)
- [platform-status.md](../platform-status.md)
