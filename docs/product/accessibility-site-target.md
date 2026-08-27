# Accessibility settings (site target)

Site-level accessibility and QA preferences live in **`sites.site_settings`** (JSON). They define the **reporting lens** for a site — what appears in dashboards, issue lists, and scores — not what the scanner stores.

## Scan vs report separation

| Layer | Storage | Behaviour |
|-------|---------|-----------|
| **Scanner** | `default_scan_config` + queue `raw_config` | Crawl scope, browser, auth, schedule. Always runs **full** axe inventory and **all** QA checks. Every finding is saved to PocketBase. |
| **Site settings** | `site_settings` | WCAG target, ARIA/best-practice toggles, issue types, QA visibility, notifications. Filters **display and scoring** only. |

This matches SiteImprove-style **site targets**: the crawl captures everything; the target defines your goal and what counts in reports.

Configure site settings from **Sites → edit (pencil) → Site settings** modal (`SiteSettingsModal.vue`).

Configure crawl execution from **Configure Scan** (`ScanConfigModal.vue`) or the **Scan** button in site settings (queues using `default_scan_config`).

## Field reference

### Accessibility accordion

| Field | UI | Meaning |
|-------|-----|---------|
| `wcagVersion` | Radio: 2.0 / 2.1 / 2.2 | WCAG document version for the site target. Issues above this version are hidden from target views. |
| `wcagConformance` | Radio: A / AA / AAA | Target level. Includes that level and **all lower** levels (AA → A + AA). |
| `ariaConformance` | Checkbox | Include WAI-ARIA authoring-practice style checks (axe ARIA rules without a WCAG SC). |
| `bestPractices` | Checkbox | Include non-WCAG best-practice rules (axe `best-practice` tag family). |
| `includeIssues` | Checkbox | Include confirmed violations (`type`: error, warning). |
| `includePotentialIssues` | Checkbox | Include axe incomplete / needs-review findings (`type`: review). |

### Quality Assurance accordion

Controls which QA modules appear in **this site’s** QA reports (data is still collected on scan):

| Field | Meaning |
|-------|---------|
| `checkLinks` | Show broken link results |
| `checkSpelling` | Show spelling results |
| `spellLanguage` | Dictionary when spelling is enabled |
| `checkReadability` | Show readability scores |
| `runPolicies` | Show custom policy matches |

### Notifications accordion

| Field | Meaning |
|-------|---------|
| `notifyEmail` | Email address for completion notifications (future delivery) |
| `diffFromPrevious` | Scanner computes scan diff when enabled (read from `site_settings` at scan completion) |

## How filtering works

Logic: `app/utils/siteSettings.ts` → `issueInSiteTarget()`.

1. **Issue type** — potential vs confirmed per checkboxes above.
2. **Category** — each issue is classified:
   - **WCAG** — has `wcag_sc`, or default WCAG rule.
   - **ARIA** — `aria-*` rules / `element_type: aria` without SC (when ARIA toggle applies).
   - **Best practice** — known best-practice rule IDs without SC.
3. **WCAG version** — issue `wcag_version` must be ≤ selected target version.
4. **Conformance level** — issue `wcag_level` must be within levels included for the target (e.g. AA → A or AA).

Dashboard composable `useAccessibility()` applies this filter via `siteTargetIssues` before user filters and score calculation.

## Scoring

Accessibility scores (`siteimproveScore.ts`) on the overview/issues pages are computed from **site-target issues** (open, non-dismissed), not the full raw inventory.

Stored scan scores on `scans` records reflect the full crawl; live dashboard scores respect the current site target.

## Engine note (axe, not a separate ARIA product)

SiteNook uses **axe-core** for all accessibility rules. “WAI-ARIA authoring practices” and “best practices” are **categories** in the site target, not a switch to a different engine. The scanner always runs the full axe tag set (`DEFAULT_AXE_TAGS` in `axeRunner.ts`).

## Defaults and migration

- New sites: `buildDefaultSiteSettingsRecord()` on create (`useSites.createSite`).
- PocketBase migration `1730000017_site_settings.js` adds `site_settings` and moves legacy reporting fields out of `default_scan_config`.
- Missing `site_settings`: `parseSiteSettings()` falls back to legacy keys on `default_scan_config` if present.

## Related files

| File | Role |
|------|------|
| `apps/web/app/utils/siteSettings.ts` | Parse, serialize, filter, summaries |
| `apps/scanner/src/config/siteSettings.ts` | Scanner read of `diffFromPrevious` |
| `apps/web/app/components/sites/SiteSettingsModal.vue` | UI |
| `apps/web/app/composables/useAccessibility.ts` | Applies target filter to issues/scores |
| [modals.md](../design/modals.md) | Modal layout for Site settings |
