# SiteNook — Style Guide

Reference for UI patterns in the Nuxt dashboard (`apps/web`). Prefer reusing these components and class combinations instead of inventing new layouts.

## Design tokens

Defined in `apps/web/app/assets/css/main.css` and Nuxt UI theme (`app/app.config.ts`).

| Token | Usage |
|-------|--------|
| `neutral` (`primary` in app config) | Default buttons, links, and UI chrome — **not** green |
| `--color-action-solid` / `--color-action-solid-text` | High-contrast solid buttons (black on light, white on dark) |
| `--color-chart-line` (`#00c16a`) | Chart line and area fill only — data accent, not buttons |
| `text-muted` / `text-default` | Supporting copy vs body text |
| `bg-default`, `bg-elevated` | Panels and hover rows |
| `border-default` | Cards and table borders (no outer `ring` on tables) |
| `text-error`, `text-warning`, `text-info`, `text-success` | Severity and status |

**Buttons:** Default `UButton` uses `color="neutral"` + `variant="solid"` with `--color-action-solid` fill. Secondary actions use `variant="outline"`. Do **not** use green (`color="primary"` with green) for button fills.

**Chart accent:** `#00c16a` via `app/utils/chartTheme.ts` — shared line color, area gradient, and tooltip palette for `MetricTrendCard` and `TrendChart`.

**WCAG level chip** (issues tables): dark green pill — see `.wcag-chip` in `IssuesTable.vue` (`#0f3d28` bg, `#27a16a` text, 10px semibold). This is semantic WCAG branding, not the global primary button color.

## Page layout

- Main content: `UDashboardPanel` + `DashboardPageNavbar` in `#header`, scrollable `#body`.
- Section titles: `font-semibold` (`h2` on list pages), with `mb-4` before the section content.
- **Flat sections (preferred for list pages):** no outer card wrapping toolbars + tables. Use `space-y-4` between toolbar and table, matching `app/pages/scans/index.vue`.
- Section spacing: `mb-6` between major sections on overview-style pages.

## Page elements (cards, containers, sections)

Use the **Scans page** (`app/pages/scans/index.vue`) and **Accessibility overview** (`app/pages/sites/[id]/accessibility/index.vue`) as references.

| Element | When to use | Markup / component |
|---------|-------------|-------------------|
| **Section** | Group related content with a heading | `<section class="mb-6">` + `<h2 class="font-semibold mb-4">` |
| **Flat table page** | Toolbar + data table (Issues, Scans) | No outer `ring` / padding wrapper — toolbar and table are siblings in `space-y-4` |
| **Standalone card** | Single metric block, score summary, scan status | `UCard` with elevated surface (see [Cards](#cards) below) |
| **Metric trend card** | Sparkline KPI on overview dashboards | `AccessibilityMetricTrendCard` — uses shared card surface + sparkline |
| **Table container** | Grid rows only | `table-surface` utility (`bg-elevated/25`, `ring ring-default`) on the table wrapper — **not** around the toolbar |
| **Table footer** | Filter summaries, pagination | `border-t border-default px-4 py-2` inside `table-surface` (same background as card) |
| **Table header (overview)** | Title + Columns menu | `tableTitle` + built-in Columns dropdown on `AccessibilityIssuesTable` |

### Do not

- Wrap an entire Issues/Scans toolbar + table in `rounded-lg bg-default ring ring-default` with `p-4 sm:px-6` — that adds an extra outer border and padding (legacy pattern).
- Put filter summaries above the table — they belong in the table footer (`footer-summary` prop on issues/pages tables).

### Overview accessibility page structure

```
<section> ScanStatusSummaryCard (UCard)
<section> Score donuts (UCard)
<section> Trends — AccessibilityTrendMetrics (3 × AccessibilityMetricTrendCard)
<div grid> Open issues table | Resolved issues table
```

Each preview table keeps its own inner border; section headings sit outside the table card.

Top-right of the accessibility overview: `AccessibilityOverviewDateRangeControls` (30 / 90 day toggle + Custom date range popover). All trends, scan summary, donuts, and preview tables respect the selected range.

## Cards

Dashboard cards use a shared elevated surface so panels read clearly on `bg-default` page chrome.

| Property | Value |
|----------|--------|
| Background | `bg-elevated/25` on `UCard` root |
| Border | `border border-default` (subtle outline; no heavy ring) |
| Body padding | `p-4 sm:p-6` (overview score card) or `p-4 sm:p-5` (metric trend cards) |

**Reusable `ui` object (overview):**

```vue
const overviewCardUi = {
  root: 'bg-elevated/25 border border-default',
  body: 'p-4 sm:p-6'
}
```

**Where applied**

| Component | Notes |
|-----------|--------|
| `ScanStatusSummaryCard` | Root `UCard` |
| Accessibility overview score block | `UCard` wrapping donuts |
| `AccessibilityMetricTrendCard` | Root `UCard` |
| Table footers | `bg-elevated/25` + `border-t` (not a full card) |

Do **not** wrap toolbar + table together in a card — only standalone metrics, summaries, and chart KPIs.

## Accessibility scoring (Siteimprove model)

Implemented in `app/utils/siteimproveScore.ts` (scanner: `apps/scanner/src/accessibility/siteimproveScore.ts`).

| Component | Weight |
|-----------|--------|
| WCAG checks (A / AA / AAA) | 90 points, level weights 3 / 2 / 1 |
| Best-practice checks | 10 points |

Per check: progress from `(total − failed) / total` with **logarithmic** scaling; element rules (e.g. `image-alt`) use site-wide element counts from crawl HTML. Scans store `score_overall` plus per-level `score_a` / `score_aa` / `score_aaa`. Live dashboard recomputes from open issues with estimated element totals.

Exact parity with Siteimprove’s patented DCI is not possible without their full check catalog and pass/fail inventory; this follows their published methodology.

## Score donut (`AccessibilityScoreDonut`)

Segmented ring chart for WCAG scores on the accessibility overview.

| Variant | Use | Segments |
|---------|-----|----------|
| Overall (large) | Main score + impact breakdown | Open issues by impact (critical → minor); hover tooltips show count and % |
| Level (`A` / `AA` / `AAA`, `size="sm"`) | WCAG level scores | Score vs remaining; same rounded/gap styling |

**Visual style (Chart.js doughnut)**

- `borderRadius: 5` — subtle rounded arc ends (not pill-shaped)
- `spacing: 3` — small gaps between segments
- Score **100%**: single segment, `borderRadius: 0`, `spacing: 0` — full closed ring
- `cutout` ~72–76% — large center hole for score label
- Impact colors: critical `#ef4444`, serious `#f97316`, moderate `#eab308`, minor `#a78bfa`
- Level score arc: green / amber / red by score threshold; track `rgba(255,255,255,0.06)`
- Tooltips enabled per segment (impact: `Label: N (pct%)`; level: `Score: N%`)

Center label stays `pointer-events-none`; info icon on overall chart remains clickable.

## Overview date range

`AccessibilityOverviewDateRangeControls` — top-right of `sites/[id]/accessibility/index.vue`.

| Control | Behavior |
|---------|----------|
| **30 days / 90 days** | Segmented toggle (same chrome as `AccessibilityIssuesViewTabs`: `h-8`, white active pill) |
| **Custom** | `UButton` outline + `UPopover` with start/end date inputs and Apply |

State: `OverviewDateRange` in `app/utils/overviewDateRange.ts`. Helpers: `overviewRangeBounds`, `filterScansByDateRange`, `deltaComparisonLabel`.

Selecting a range updates trends (`buildDailyTrendSeries` with `DateRangeBounds`), latest scan summary in range, donut scores from that scan, and preview issue tables (issues whose `scan` is in range).

## Table footer “View all” link

Overview preview tables pass `footer-link` to `AccessibilityIssuesTable` — renders `TableFooterLinkButton` on the **right** of the table footer (with pagination when present).

Button style (matches “View Real Time” reference):

```
inline-flex items-center gap-1.5 rounded-lg border border-default
bg-elevated/50 px-3.5 py-1.5 text-sm font-medium text-default
hover:bg-elevated hover:border-muted
+ trailing i-lucide-chevron-right
```

Do **not** place “View all” below the table as a plain text link on overview previews.

## Metric trend charts

Three sparkline cards on the accessibility overview (`AccessibilityTrendMetrics`):

| Card | Series source | Value |
|------|---------------|-------|
| Score trend | `scan.score_aa` (fallback `score_a`) | Latest AA % |
| Open issues | `scan.open_issue_count` | Latest count |
| Pages with issues | Unique pages with open issues per scan | Latest count |

Implementation:

- Shared daily series: `app/utils/scanTrendSeries.ts` (`buildDailyTrendSeries`, `trendDelta`)
- Card shell: `app/components/accessibility/MetricTrendCard.vue`
- Row composer: `app/components/accessibility/TrendMetrics.vue`

Chart styling (Chart.js via `vue-chartjs`, shared `app/utils/chartTheme.ts`):

- Smooth line: `tension: 0.42`, `borderColor: #00c16a`, `borderWidth: 2`
- Area fill: vertical gradient from `rgba(0, 193, 106, 0.5)` → transparent (`chartAreaFill()`)
- Hidden axes on sparklines: `scales.x/y.display: false` — tooltip on hover only
- **Tooltip:** card-style — white (light) or `#1a1a1a` (dark), `1px` border, bold title, colored dot (`#00c16a`), label + bold value (`buildChartTooltipOptions()`)
- Card layout: 11px uppercase muted title, `text-2xl sm:text-3xl` value, `text-sm` subtitle, 88px-tall chart, optional delta line (`text-success` / `text-error`)

## Issue row actions

Shared menu builder: `app/utils/issueActions.ts`

Both **Issues** and **By page** tables use `issueRowActionGroups()`:

1. View details (`i-lucide-eye`)
2. Rescan page (`i-lucide-refresh-cw`)
3. Mark as fixed (`i-lucide-check`)
4. — separator —
5. Dismiss — won't fix / false positive / defer (`i-lucide-x`)

Issue detail drawer dismiss dropdown uses the same `dismissActionItems()` labels.

## Page layout (legacy note)

Older pages used a single content card: `rounded-lg bg-default ring ring-default divide-y divide-default` with `p-4 sm:px-6` inner padding. Prefer flat sections + per-component table borders instead.

## Table toolbar

Standard row for data tables (issues, pages):

```
[ Leading: view tabs ]     [ Search | Columns | Filters ]
```

| Control | Component | Notes |
|---------|-----------|--------|
| Toolbar shell | `DataTableToolbar` | Leading + actions slots; actions use `flex-nowrap` so controls stay on one row |
| Search | `TableSearchInput` | Always-visible compact `UInput` (`size="sm"`, `bg-elevated`, `ring-muted`, `w-44 sm:w-56`) |
| Columns | `UDropdownMenu` + `TableToolbarMenuButton` | `icon="i-lucide-columns-3"` — **no** chevron on the button |
| Filters | `AccessibilityIssueFiltersMenu` | Uses `TableToolbarMenuButton`; `active-ring` when filters active |
| Button order (actions) | — | Search → Columns → Filters |

**Naming:** `components/shared/*` is registered with `pathPrefix: false` in `nuxt.config.ts`, so use `DataTableToolbar` and `TableSearchInput` — **not** a `Shared*` prefix.

```html
<DataTableToolbar>
  <template #leading>
    <AccessibilityIssuesViewTabs v-model="pageTab" />
  </template>
  <template #actions>
    <TableSearchInput v-model="tableSearch" placeholder="Search issues…" />
    <UDropdownMenu :items="columnMenuItems">
      <TableToolbarMenuButton label="Columns" icon="i-lucide-columns-3" />
    </UDropdownMenu>
    <AccessibilityIssueFiltersMenu v-model="filters" :issues="issues" />
  </template>
</DataTableToolbar>
```

Layout rules:

- **Do not** use `flex-wrap` on the actions cluster.
- Child tables use `hide-toolbar` and `v-model:search`; expose `columnMenuItems` from the table for the parent Columns menu.
- Prefer `v-show` over `v-if` when switching Issues / By page so column menus stay wired.

See also [tables.md](./tables.md) for TanStack search and column-toggle implementation.

## View segment tabs (Issues / By page)

Bordered tab list with sliding indicator — use `AccessibilityIssuesViewTabs`:

```vue
<AccessibilityIssuesViewTabs v-model="pageTab" />
```

Implementation (`IssuesViewTabs.vue`): `UTabs` with `:content="false"`, `color="neutral"`, `size="sm"`, and list/trigger/indicator `ui` overrides:

- **Height:** `h-8` on the tab list (matches toolbar row — see `DataTableToolbar`)
- **List:** `h-8 p-0.5 rounded-lg bg-default dark:bg-elevated/50 border border-default`
- **Indicator:** white sliding pill — `inset-y-0.5 rounded-md shadow-sm bg-white dark:bg-white`
- **Trigger:** `h-7 text-sm`; inactive = `text-muted`; active label = near-black (`rgb(10 10 10)`) on the white pill via scoped CSS

Do **not** use `variant="pill"` + `size="xs"` for this control — that is the older compact style (still used on Scans queue Active/History where appropriate).

### Toolbar control sizing (search + menu buttons)

All controls in the actions cluster must match **`size="sm"` / `h-8` / `text-sm`**:

| Control | Component |
|---------|-----------|
| Search | `TableSearchInput` (`h-8`, `text-sm`, `placeholder:text-muted`) |
| Columns / Filters | `TableToolbarMenuButton` (`UButton` `size="sm"`, `h-8`) |

Use `DataTableToolbar` (`h-8` on the full row, leading + actions) so tabs and controls share one height.

### Table footer summary

Issue counts (e.g. `Showing 2 of 2 issue types (9 occurrences)`) and page counts (`Showing 2 of 2 pages with issues`) belong in the **table footer**, not above the grid. Pass `footer-summary` to `AccessibilityIssuesTable` or `AccessibilityPagesBreakdownTable`; it renders inside the bordered table card below the rows, left-aligned; pagination stays on the right when needed.

## Table search input

`TableSearchInput` — always open, matches Nuxt UI compact search fields:

```vue
<UInput
  size="sm"
  icon="i-lucide-search"
  :ui="{
    root: 'relative inline-flex items-center w-auto',
    base: 'bg-elevated ring-muted'
  }"
  class="w-44 sm:w-56 shrink-0"
/>
```

## Toolbar menu buttons (Columns / Filters)

- `color="neutral"`, `variant="outline"`
- Leading icon only (`icon="…"`) — **never** `trailing-icon="i-lucide-chevron-down"` on the trigger
- Dropdown behavior is implied by `UDropdownMenu`; chevrons are not shown on the face button

## Filter pills (legacy / resolved page)

Inline pill buttons when not using the dropdown:

- Base: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors`
- Active: `bg-elevated text-default border-default ring-1 ring-default shadow-sm`
- Inactive: `bg-elevated/50 text-muted border-default hover:bg-elevated hover:text-default`
- Count badge: `tabular-nums text-xs px-1.5 py-0.5 rounded-full` — active uses `bg-default`, inactive `bg-elevated`

## Tables

- Wrapper: `table-surface` (`apps/web/app/assets/css/main.css`) — `bg-elevated/25`, single `border-default`, **no ring**
- Global `UTable` defaults in `app.config.ts`: uppercase muted headers (`text-xs`), row dividers (`border-b border-default/50`), generous `py-3.5` cell padding, subtle hover (`hover:bg-elevated/20`)
- Used on: `IssuesTable`, `PagesBreakdownTable`, `SiteScansTable`, active scan queue table
- Panel spacing: `space-y-4` on `*-table-panel` roots
- Sortable headers: ghost `UButton` with `i-lucide-arrow-up-down` / sorted icons, `class="-mx-2.5"`
- Row actions: ghost icon button → `UDropdownMenu` (`i-lucide-ellipsis-vertical`)
- Pagination: `UPagination` right-aligned when rows exceed page size

## Status and severity

- Table severity text: `text-error` (critical/serious), `text-warning` (moderate), `text-info` (minor)
- Scan status: `StatusBadge` + `statusColor()` helpers in scan components

## Icons (Lucide via Nuxt UI)

| Action | Icon |
|--------|------|
| Search | `i-lucide-search` |
| Columns | `i-lucide-columns-3` (leading on Columns button) |
| Filters | `i-lucide-list-filter` (leading on Filters button) |
| Refresh | `i-lucide-refresh-cw` |
| More actions | `i-lucide-ellipsis-vertical` |

## Do not

- Use `Shared*` prefixes for `components/shared/*` (see `nuxt.config.ts` `pathPrefix: false`).
- Put chevron icons on Columns/Filters toolbar buttons.
- Use collapsed/icon-only search in table toolbars — use `TableSearchInput`.
- Use `variant="pill"` + `size="xs"` for Issues/By page view tabs — use `AccessibilityIssuesViewTabs`.
- Duplicate PocketBase clients or ad-hoc filter state outside composables (`useAccessibility` filters on issues page).

## File map

| Pattern | Location |
|---------|----------|
| Table toolbar layout | `app/components/shared/DataTableToolbar.vue` → `DataTableToolbar` |
| Table search | `app/components/shared/TableSearchInput.vue` → `TableSearchInput` |
| Toolbar menu buttons | `app/components/shared/TableToolbarMenuButton.vue` → `TableToolbarMenuButton` |
| Issues filter dropdown | `app/components/accessibility/IssueFiltersMenu.vue` |
| Issues / By page tabs | `app/components/accessibility/IssuesViewTabs.vue` → `AccessibilityIssuesViewTabs` |
| Issues page toolbar wiring | `app/pages/sites/[id]/accessibility/issues.vue` |
| Accessibility overview | `app/pages/sites/[id]/accessibility/index.vue` |
| Metric trend cards | `app/components/accessibility/MetricTrendCard.vue`, `TrendMetrics.vue` |
| Overview date range | `app/components/accessibility/OverviewDateRangeControls.vue`, `app/utils/overviewDateRange.ts` |
| Score donut | `app/components/accessibility/ScoreDonut.vue` |
| Table footer link button | `app/components/shared/TableFooterLinkButton.vue` |
| Issue row actions | `app/utils/issueActions.ts` |
| Scan trend series | `app/utils/scanTrendSeries.ts` |
| Chart theme (line, area, tooltip) | `app/utils/chartTheme.ts` |
| Issues table (no toolbar) | `app/components/accessibility/IssuesTable.vue` |
| Pages table (no toolbar) | `app/components/accessibility/PagesBreakdownTable.vue` |
| Scans queue tabs (legacy pill xs) | `app/components/scans/ActiveScansTable.vue` |
