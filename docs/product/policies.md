# Policies

Policies let Business+ orgs control what appears in reports:

| Kind | What it does |
|------|----------------|
| **Flag content** | Keyword, regex, or HTML-attribute rules evaluated against page HTML → hits in `policy_matches` |
| **Exclude from accessibility** | CSS selectors passed to axe `exclude` at scan time so elements (e.g. YouTube iframes) never create accessibility issues |

## Surfaces

| Surface | Route | Purpose |
|---------|-------|---------|
| Rules | `/policies` | Create, edit, enable/disable, delete policies |
| Org matches | `/qa/policies` | Triage **flag content** matches across the workspace |
| Site matches | `/sites/:id/qa/policies` | Triage flag matches for one site |

Exclude policies do not create matches — they take effect on the **next scan**.

Sidebar **Policies** opens the rules page. QA nav **Policies** opens match findings.

## Scope and plans

- A policy can bind to **one site** or **all sites** in the organization (`site` empty + `organization` set).
- Feature is plan-gated to **Business** and **Enterprise** (`plan-feature` middleware + PocketBase create hook).
- Site setting **Run custom policies** (`site_settings.runPolicies`) must be on for the scanner to load policies (both kinds). Main and background scans also require the org plan to include policies.

## Flag content match lifecycle

`policy_matches.status`: `open` → `dismissed` or `fixed` (reopen returns to `open`). Updates go through `POST /api/sites/:siteId/qa/issues/bulk-status` with `issueType: 'policy_matches'`.

## Accessibility exclusions

- `kind = exclude_from_accessibility`, `rule_type = css_selector`
- `pattern` is one or more CSS selectors (newline or comma separated)
- UI presets: YouTube embeds, common embeds, all iframes
- Scanner: `axeExcludeSelectorsFromPolicies()` → `AxeBuilder.exclude()` in `runAxeOnPage`

## Related

- [scans.md](./scans.md) — scan config / findings
- [platform-status.md](../platform-status.md) — shipped status
