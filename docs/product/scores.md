# Score calculation

How SiteNook computes the scores shown on the **Accessibility** and **Quality Assurance** overview pages.

Core logic: `apps/web/app/utils/siteimproveScore.ts` (mirrored in `apps/scanner/src/accessibility/siteimproveScore.ts`). Scan aggregation: `apps/scanner/src/crawler/siteCrawler.ts` → `aggregateScores()`.

---

## Stored vs live scores

| Source | When used | What it includes |
|--------|-----------|------------------|
| **Stored scan scores** (`scans.score_*`, `scans.score_denominators`) | Written when a crawl finishes; overview prefers latest scan in date range | Full crawl at scan time |
| **Live dashboard scores** | Fallback when stored value is `null`, `undefined`, or `0` | Site-target issues (`issueInSiteTarget`) with **cached denominators** from `sites.score_denominators` |

After each completed scan, the scanner persists `score_denominators` on both the **scan** and **site** records so live scoring uses the same element/link/word totals as the scanner (HTML snapshots), not the legacy `max(count × 2, count + 5)` estimate.

**Overview display rule** (`apps/web/app/utils/scanScores.ts` → `preferStoredScanScore()`):

- Use the **stored** scan field when it is present and non-zero.
- Fall back to **live** recalculation only when stored is missing or literally `0`.

This prevents incomplete live issue sets from overriding correct scanner scores. The score delta on the site-target donut compares **stored** `score_overall` only — both current and previous scans must have `score_overall > 1` or the delta is hidden.

---

## Accessibility score

Siteimprove-style model. Scores are **0–100** (one decimal).

### Point pools

| Pool | Points |
|------|--------|
| WCAG conformance | 90 |
| Best practices | 10 |

**Overall** = WCAG earned + best-practice earned (max 100). No open/dismissed issues → **100**.

### Per-check weights

| Check type | Weight |
|------------|--------|
| WCAG A | 3 |
| WCAG AA | 2 |
| WCAG AAA | 1 |
| Best practice | 0.5 |

### Resolved ratio + logarithmic curve

Per axe rule (check):

1. **Failed** = weighted sum of **open** occurrences (`status === 'open'`).
2. **Dismissed** occurrences count toward **total** (resolved side) but not failed — prevents score inflation from dismissing instead of fixing.
3. **Fixed** issues are excluded entirely.
4. **Total** = `max(elementDenominator, failed + dismissed, …)` from HTML snapshot counts when available.
5. **Resolved ratio** = `(total − failed) / total`
6. **Progress** = `logarithmicProgress(resolvedRatio)` with `k = 9`.

### Element denominators

**Scanner:** counted from HTML snapshots (`countElementsFromHtmlSnapshots`) — images, links, forms, headings, tables, media.

**Live dashboard:** uses `sites.score_denominators.elements` from the latest scan; falls back to `estimateElementTotalsFromIssues()` only when no cache exists.

### Page depth weighting (optional)

Site setting: `site_settings.depthWeightedScoring` (default **off**).

When enabled, each page gets weight `w = 1 / (crawlDepth + 1)`, normalised across the crawl. Issue occurrences and element counts are multiplied by this weight when aggregating in `aggregateScores()`.

### Level scores (A / AA / AAA)

Computed separately per WCAG level (best practices excluded). No checks at that level → **100**.

### Best practices category (“S” row)

The overview **Accessibility best practices** row shows progress toward 100% for non-ARIA best-practice axe rules.

| Case | Category score |
|------|----------------|
| No best-practice checks in the crawl | **100** (empty pool awards full 10-point pool in overall, same as WCAG levels with no checks) |
| Checks present, zero open failures | **100** |
| Checks present with open failures | Weighted progress via `bestPracticeCategoryScore()` / `scoreBestPracticeCategory()` |

**Scanner:** `aggregateScores()` writes `score_best_practices` alongside `score_overall` and level scores.

**Dashboard:** `resolveBestPracticeScore()` prefers `scans.score_best_practices`, then legacy derivation from `score_overall` + level scores (pre-migration scans), then live `calculateTargetCategoryScores()`.

### Points to gain

| Function | Meaning | UI |
|----------|---------|-----|
| `pointsToGainIfAllResolvedForRule()` | Score delta if **all open** occurrences of a rule are fixed | **Primary** “Points to gain” column |
| `pointsToGainForRule()` | Score delta if **one** occurrence is fixed | Shown in column tooltip |

### Dismissed issues

Included in scoring input with `status === 'dismissed'`. They increase the check total (resolved side) but not the failure count.

---

## QA score

Ratio-based model using the same logarithmic curve as accessibility.

### Pools

| Component | Pool points |
|-----------|-------------|
| Broken links | 65 |
| Spelling errors | 35 |

### Per component

```text
resolvedRatio = (total − failed) / total
earned = poolPoints × logarithmicProgress(resolvedRatio)
score_qa = linkEarned + spellEarned
```

| Metric | Numerator (failed) | Denominator (total) |
|--------|-------------------|---------------------|
| Links | `qa_broken_links` with `status === 'broken'` | `<a>` count from HTML snapshots |
| Spelling | `qa_spelling` with `confidence === 'error'` | `wordCount` summed across crawled pages |

Empty denominator → full pool awarded for that component.

Page depth weighting applies to QA counts when `depthWeightedScoring` is enabled.

`site_settings` QA toggles affect **report visibility**, not how `score_qa` is calculated at scan time.

---

## Persistence

| Field | Collection | Contents |
|-------|------------|----------|
| `score_overall`, `score_a`, `score_aa`, `score_aaa`, `score_best_practices`, `score_qa` | `scans` | Stored scores |
| `score_denominators` | `scans`, `sites` | `{ elements: ElementTotals, qa: { totalLinks, totalWords, totalPages } }` |

Migrations: `1730000016_scan_score_overall.js`, `1730000018_score_denominators.js`, `1730000019_scan_score_best_practices.js`. Runtime patch: `patch-score-denominators.sh` (also adds `score_best_practices` on existing deployments).

---

## Score history chart

`AccessibilityTrendMetrics` builds a daily series from **all completed scans** in the selected date range (`complete` and `complete_with_errors`), plotting `score_overall` over time via `buildDailyTrendSeries()`.

---

## Related files

| File | Role |
|------|------|
| `apps/web/app/composables/useAccessibility.ts` | Live scores, cached denominators, points to gain |
| `apps/web/app/utils/scanScores.ts` | Stored-vs-live preference, delta baseline guard, best-practice resolve |
| `apps/web/app/pages/sites/[id]/accessibility/index.vue` | Overview donuts, category rows, score delta |
| `apps/web/app/utils/siteSettings.ts` | `depthWeightedScoring`, site target filter |
| `apps/web/app/components/accessibility/TrendMetrics.vue` | Score trend chart |
| `apps/web/app/components/accessibility/IssuesTable.vue` | Points to gain column |
| `apps/scanner/src/crawler/siteCrawler.ts` | `aggregateScores()`, PocketBase score write |
| [accessibility-site-target.md](./accessibility-site-target.md) | Site target / report filter |

---

## Tests

| File | Covers |
|------|--------|
| `apps/web/tests/unit/utils/siteimproveScore.test.ts` | QA ratio, dismissed, denominators, points to gain, empty BP pool |
| `apps/web/tests/unit/utils/scanScores.test.ts` | Stored preference, delta guard, best-practice resolve |
| `apps/scanner/tests/unit/accessibility/siteimproveScore.test.ts` | Scanner copy |
| `apps/scanner/tests/unit/crawler/aggregateScores.test.ts` | Score aggregation + PocketBase field mapping |
| `apps/web/tests/unit/composables/useAccessibility.test.ts` | Live score + points to gain |
