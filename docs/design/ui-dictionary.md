# SiteNook UI Dictionary

Canonical names for dashboard UI elements. Use these labels when discussing changes so agents and humans refer to the same thing.

**Format:** **UI name** — short description. Component file in backticks when helpful.

---

## Global chrome

| Name | Description |
|------|-------------|
| **App shell** | `UDashboardGroup` layout: sidebar + main panel. `app/layouts/default.vue` |
| **Sidebar** | Left navigation with site context. Collapsible on mobile. |
| **Site selector** | Dropdown in sidebar header to pick the active site. `SiteSelector` |
| **User menu** | Account menu (bottom of sidebar). `UserMenu` |
| **Page navbar** | Top bar inside a page panel: title + optional right actions. `DashboardPageNavbar` |
| **Scan trigger button** | Primary action to queue a scan for the current site. `ScanTriggerButton` |

### Sidebar navigation links

| Name | Route |
|------|-------|
| **Overview** (home) | `/` |
| **Sites** | `/sites` |
| **Accessibility** (group) | — |
| **Accessibility → Overview** | `/sites/:id/accessibility` |
| **Accessibility → Issues** | `/sites/:id/accessibility/issues` |
| **Accessibility → Readability** | `/sites/:id/accessibility/readability` |
| **Accessibility → PDFs** | `/sites/:id/accessibility/pdfs` (library) |
| **Accessibility → PDF Inspector** | `/sites/:id/accessibility/pdfs/:documentId` — breadcrumb `PDFs / PDF Inspector` |
| **Quality Assurance** (group) | — |
| **QA → Overview** | `/sites/:id/qa` |
| **QA → Broken Links** | `/sites/:id/qa/links` |
| **QA → Spelling** | `/sites/:id/qa/spelling` |
| **QA → Policies** | `/sites/:id/qa/policies` |
| **QA → Inventory** | `/sites/:id/qa/inventory` |
| **SEO** (group) | — |
| **SEO → Overview** | `/sites/:id/seo` |
| **SEO → Technical** | `/sites/:id/seo/technical` |
| **SEO → Content** | `/sites/:id/seo/content` |
| **SEO → Search Result Preview** | `/sites/:id/seo/preview` |
| **Search** | `/search` |
| **Scans** | `/scans` |
| **Reports** | `/reports` *(stub — page not implemented)* |
| **Policies** | `/policies` (rules); `/qa/policies` (matches) |
| **Settings** | `/settings` |

---

## Sites

### Sites list (`/sites`)

| Name | Description |
|------|-------------|
| **Sites table** | Registered targets with schedule, last scan, scores. `SitesTable` |
| **Add site** | Flow to register a new crawl target (page-level action). |

### Site detail (`/sites/:id`)

| Name | Description |
|------|-------------|
| **Site overview** | Landing page for a single site (summary / links). |

---

## Accessibility — Overview (`/sites/:id/accessibility`)

Main score and trend dashboard for one site.

| Name | Description |
|------|-------------|
| **Site target badge row** | Row of WCAG / ARIA / best-practice target badges with edit affordance. `SiteTargetBadgeRow` |
| **Overview date range controls** | Top-right **30 days / 90 days** toggle + **Custom** date popover. Filters all overview data. `OverviewDateRangeControls` |
| **Accessibility data source card** | Scan status summary showing which completed scan powers the overview metrics. `ScanStatusSummaryCard` (title: "Accessibility Data Source") |
| **Overview score section** | Main 1/3 + 2/3 grid: donut, trends, conformance, score details. `OverviewScoreSection` |

#### Overview score donut

Thick annular-sector ring (`ScoreDonut` + `utils/donutChart.ts`): cutout ~75% of radius, soft corner fillets, even gaps. Overview display size **255px** (Nuxt Charts `DonutChart` width). Palette tokens `--donut-segment-1`…`5`. Centre label: value + unit baseline, caption below. Wrapped in `ScoreDonutButton` (no square frame; hover uses segment halo on the ring, plus a small expand hint). Click opens `ScoreBreakdownModal`: donut + slice legend on the left, category/impact detail on the right. Card header **Score donut menu** (`ScoreDonutMenu`, top-right ellipsis): checked **Full donut** / **Semi donut** (persisted via `useDonutChartStyle`) plus **Score breakdown**.

#### Overview score section — left column (1/3)

| Name | Description |
|------|-------------|
| **Site target score** | Heading above the large donut chart. |
| **Site target donut** | Large ring chart showing overall site target score (%), optional delta, hover “could be” preview. `ScoreDonut` (`variant="site-target"`) |
| **Conformance levels card** | Card listing per-level progress bars (A, AA, AAA, ARIA, best practice). Click/hover opens impact modal. |

#### Overview score section — right column (2/3)

| Name | Description |
|------|-------------|
| **Trend metrics row** | Two sparkline cards side by side (50/50). `TrendMetrics` |
| **Score trend card** | Left trend card: overall accessibility score over time. `MetricTrendCard` |
| **Issues trend card** | Right trend card: toggles **Open issues** vs **Pages with issues** via top-right segment switch. `MetricTrendCard` + `UTabs` |
| **Issues trend switch** | **Issues / Pages** segmented control on the issues trend card header. |
| **Score details card** | Impact summary, quick stats, top rules to fix, **View all issues** button. `ScoreCategoryInfoPanel` |
| **Score impact** | Subsection in score details: points dragged down by open issues. |
| **Quick stats** | Three stat tiles: Failing rules, Occurrences, Pages affected. |
| **Top rules to fix** | Ranked list of rules with points-to-gain in score details. |
| **View all issues button** | Primary CTA at bottom of score details → issues page / impact modal. |

#### Overview score section — modals

| Name | Description |
|------|-------------|
| **Category impact modal** | Drill-down for a conformance row or overall impact. `ScoreCategoryImpactModal` |
| **Site settings modal** | Edit site target levels, schedule, scan config. `SiteSettingsModal` |

#### Overview — preview tables (below score section)

| Name | Description |
|------|-------------|
| **Open issues preview table** | Top 5 open issues by points to gain. `IssuesTable` (`table-title="Open issues"`) |
| **Resolved issues preview table** | Top 5 recently resolved issues. `IssuesTable` (`table-title="Resolved issues"`) |
| **View all issues link** | Footer button on open issues preview → full issues page. `TableFooterLinkButton` |
| **View all resolved link** | Footer button on resolved preview → resolved page. |

#### Overview — drawers

| Name | Description |
|------|-------------|
| **Issue detail drawer** | Slide-over with rule explanation, affected pages, actions (read-only on overview). `IssueDetailDrawer` |

---

## Accessibility — Issues (`/sites/:id/accessibility/issues`)

| Name | Description |
|------|-------------|
| **Issues view tabs** | **Issues / By page** segmented switch in toolbar. `IssuesViewTabs` |
| **Data table toolbar** | Leading tabs + search, columns, filters. `DataTableToolbar` |
| **Table search input** | Always-visible search field. `TableSearchInput` |
| **Columns menu** | Toggle visible table columns. `TableToolbarMenuButton` + dropdown |
| **Filters menu** | Impact, WCAG level, category filters. `IssueFiltersMenu` |
| **Issues table** | Main grid of open issues (by rule). `IssuesTable` |
| **Pages breakdown table** | Alternate view: issues grouped by page URL. `PagesBreakdownTable` |
| **Issue detail drawer** | Full actions: view, rescan, mark fixed, dismiss. `IssueDetailDrawer` |
| **Affected pages table** | URLs hit by the selected rule (inside drawer). `IssueAffectedPagesTable` |

### Issues table columns (typical)

| Name | Description |
|------|-------------|
| **Issue** | Rule name + ID |
| **Impact** | critical / serious / moderate / minor |
| **Points to gain** | Estimated score improvement if fixed |
| **WCAG level** | A / AA / AAA chip |
| **Pages** | Count of affected pages |
| **Occurrences** | Total element hits |

---

## Accessibility — Resolved (`/sites/:id/accessibility/resolved`)

| Name | Description |
|------|-------------|
| **Resolved issue filters** | Status / resolution filters for fixed & dismissed issues. `ResolvedIssueFilters` |
| **Resolved issues table** | Same table shell as issues, with resolved-at and resolution columns. |

---

## Accessibility — PDF Inspector (`/sites/:id/accessibility/pdfs/:documentId`)

| Name | Description |
|------|-------------|
| **PDF Inspector** | Document studio (Audit / Extract). Breadcrumb uses literal `/`: `PDFs / PDF Inspector`. Mode tabs sit on the filename row. `sites/.../pdfs/[documentId].vue` |
| **Pages rail** | Left column of page thumbnails. `PdfPageThumbnails` |
| **Preview pane** | Middle column — PDF preview only. `PdfPreviewViewer` |
| **Issues context** | Audit right pane — issue list + guidance. `PdfAuditContext` |
| **Content context** | Extract right pane — copyable Markdown/HTML/JSON/Gutenberg/Images. `PdfConvertContext` |
| **Inspector shell** | Shared `Pages \| Preview \| Context` layout. `PdfInspectorShell` |

---

## Quality Assurance

### QA overview (`/sites/:id/qa`)

| Name | Description |
|------|-------------|
| **QA overview** | Summary cards for broken links, spelling, inventory counts. |

### Broken links (`/sites/:id/qa/links`)

| Name | Description |
|------|-------------|
| **Broken links table** | List of failing hrefs per scan. `BrokenLinkTable` |

### Spelling (`/sites/:id/qa/spelling`)

| Name | Description |
|------|-------------|
| **Spelling table** | Misspelled terms with context. `SpellingTable` |

### Inventory (`/sites/:id/qa/inventory`)

| Name | Description |
|------|-------------|
| **Inventory tree** | Hierarchical page / asset tree from crawl. `InventoryTree` |

---

## Scans (`/scans`)

| Name | Description |
|------|-------------|
| **Active scans table** | In-progress and queued scans with stop/restart actions. `ActiveScansTable` |
| **Site scans table** | Per-site scan history. `SiteScansTable` |
| **Scan detail modal** | Run metadata, scores, pages crawled, log export. `ScanDetailModal` |
| **Live crawl log panel** | Streaming crawl events for a running scan. `LiveCrawlLogPanel` |
| **Scan runs list** | Historical runs for a site (often inside site context). `ScanRunsList` |
| **Scan config modal** | Edit max pages, include/exclude URLs, auth for a scan. `ScanConfigModal` |
| **Rescan modal** | Confirm re-queue with optional config override. |

---

## Policies (`/policies` + `/qa/policies`)

| Name | Description |
|------|-------------|
| **Policies list** | Custom content policy rules (CRUD) at `/policies`. |
| **Policy matches** | Findings triage under QA (`/qa/policies` and site equivalent). |

---

## Settings (`/settings`)

| Name | Description |
|------|-------------|
| **Settings — General** | App-level preferences. `/settings` |
| **Settings — Users** | User accounts. `/settings/users` |
| **Settings — Integrations** | External integrations. `/settings/integrations` |

---

## Auth pages

| Name | Description |
|------|-------------|
| **Login page** | Email/password sign-in. `/login` |
| **Signup page** | New account registration. `/signup` |

---

## Shared UI patterns

| Name | Description |
|------|-------------|
| **Segment switch** | Bordered `h-8` pill toggle with white active indicator. Used for date range, view tabs, issues trend. See [style-guide.md](./style-guide.md) |
| **Metric trend card** | Elevated `UCard` with uppercase title, large value, sparkline, optional delta. `MetricTrendCard` |
| **Table surface** | Bordered elevated wrapper for data grids only (`table-surface` utility). |
| **Table footer** | Summary text left, pagination / footer link right. |
| **Status badge** | Colored scan/status pill. `StatusBadge` |
| **WCAG chip** | Dark green level badge in issue tables. |
| **Site target badge** | Colored A / AA / AAA / ARIA / BP pill. `.site-target-badge` |

---

## Score & accessibility concepts (UI-facing)

| Name | Description |
|------|-------------|
| **Site target score** | Weighted overall score (90% WCAG levels + 10% best practice). Siteimprove-style model. |
| **Conformance level row** | Single progress bar for one target category in the conformance card. `ScoreDetailRow` |
| **Points to gain** | Estimated score increase if an issue/rule is fixed. |
| **Score delta** | Change vs previous completed scan in the selected date range. |

---

## How to reference elements in chat

Prefer the **bold names** above, optionally with page context:

- ✅ “Move **Quick stats** below **Top rules to fix** in **Score details card**”
- ✅ “Increase spacing in **Trend metrics row** on **Accessibility overview**”
- ❌ “The card on the right” (ambiguous — could be score details, issues trend, or preview table)

When a name is new, add it to this file.
