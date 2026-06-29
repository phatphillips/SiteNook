# AccessIQ documentation

Living reference for operators, developers, and agents working on AccessIQ. For stack overview and test commands, start with [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md).

**Status snapshot:** [platform-status.md](./platform-status.md) — what ships today, known gaps, and pre-launch checklist.

---

## Naming conventions

All docs use **kebab-case** filenames (lowercase, hyphens). No spaces, Title Case, or snake_case.

| Folder | Purpose | Examples |
|--------|---------|----------|
| *(root)* | Index and cross-cutting status | `README.md`, `platform-status.md` |
| `operations/` | Run, test, deploy, reset | `commands.md`, `go-live.md` |
| `platform/` | Auth, tenancy, billing, lifecycle | `authentication.md`, `stripe-setup.md` |
| `product/` | Scanner and dashboard features | `scans.md`, `seo.md` |
| `design/` | UI patterns and component vocabulary | `style-guide.md`, `ui-dictionary.md` |
| `archive/` | Historical planning — not maintained | `project-brief.md` |

When adding a doc, pick the folder that matches its primary audience. Link related docs in a **Related** section at the bottom.

---

## Operations

| Doc | Contents |
|-----|----------|
| [operations/commands.md](./operations/commands.md) | Docker, npm scripts, tests, curl examples |
| [operations/dev-operations.md](./operations/dev-operations.md) | Purge closed orgs, reset tenants, env var mapping |
| [operations/go-live.md](./operations/go-live.md) | Production DNS, SMTP, Stripe live, E2E hardening |

---

## Platform (auth, tenancy, billing)

| Doc | Contents |
|-----|----------|
| [platform/authentication.md](./platform/authentication.md) | PocketBase login, JWT, tokens, collection rules |
| [platform/multi-tenancy.md](./platform/multi-tenancy.md) | Subdomain routing, tenant-only apex |
| [platform/users-and-teams.md](./platform/users-and-teams.md) | Org roles, billing contact, Team Members UI |
| [platform/onboarding.md](./platform/onboarding.md) | Provisioning API, self-service signup, SMTP |
| [platform/stripe-setup.md](./platform/stripe-setup.md) | Stripe Checkout, plans, webhooks |
| [platform/account-closure.md](./platform/account-closure.md) | Close org, Customer Portal, 30-day purge |
| [platform/licence-api.md](./platform/licence-api.md) | Enterprise self-hosted licence validation |
| [platform/litestream-backup.md](./platform/litestream-backup.md) | PocketBase SQLite backup to S3 |

---

## Product features

| Doc | Contents |
|-----|----------|
| [product/scans.md](./product/scans.md) | Queue, crawler, scheduling, cancellation, live log |
| [product/scores.md](./product/scores.md) | Siteimprove-style accessibility and QA scoring |
| [product/accessibility-site-target.md](./product/accessibility-site-target.md) | Site target vs scan config |
| [product/seo.md](./product/seo.md) | SEO rules, site pass, dashboard routes |
| [product/global-search.md](./product/global-search.md) | Typesense index and search API |
| [product/pdf-accessibility.md](./product/pdf-accessibility.md) | PDF crawl, VeraPDF validation, reports |

---

## Design (frontend)

| Doc | Contents |
|-----|----------|
| [design/style-guide.md](./design/style-guide.md) | Tokens, layout, toolbars, charts |
| [design/ui-dictionary.md](./design/ui-dictionary.md) | Canonical UI element names |
| [design/tables.md](./design/tables.md) | TanStack tables, search, columns |
| [design/modals.md](./design/modals.md) | Modal layout pattern |

---

## Archive

| Doc | Contents |
|-----|----------|
| [archive/project-brief.md](./archive/project-brief.md) | Original SiteImprove replacement brief (2024 planning) |

Do not treat archive docs as current behaviour. Use `product/` and `platform-status.md` instead.

---

## Agent task tracking

Active implementation todos: [CURRENT_TASK.MD](../CURRENT_TASK.MD).
