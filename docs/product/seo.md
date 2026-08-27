# SEO monitoring

SiteNook runs SEO checks during site crawls and surfaces results in the per-site **SEO** section of the dashboard. This complements accessibility and QA — same crawl pipeline, separate issue collection.

---

## Dashboard routes

| Nav item | Route | Purpose |
|----------|-------|---------|
| Overview | `/sites/:id/seo` | Score summary, trend, traffic-light cards |
| Technical | `/sites/:id/seo/technical` | Crawlability, indexability, structured data issues |
| Content | `/sites/:id/seo/content` | Titles, meta descriptions, headings, readability |
| Search Result Preview | `/sites/:id/seo/preview` | Live SERP preview editor (`SerpPreviewEditor`) |

Legacy redirects (`middleware/legacy-routes.global.ts`): `/seo/pages` → preview, `/seo/resolved` → technical.

---

## Scanner pipeline

SEO runs when `site_settings.checkSeo` is enabled (Site settings modal → SEO accordion).

| Stage | Module | Role |
|-------|--------|------|
| Per-page | `apps/scanner/src/seo/scanSeo.ts` | Parse snapshot, evaluate page rules |
| Site pass | `apps/scanner/src/seo/runSeoSitePass.ts` | Duplicate titles/descriptions, orphan pages, sitemap gaps |
| Finalize | `apps/scanner/src/seo/evaluateSeoRules.ts` | Aggregate scores, write `seo_issues` |
| Score | `apps/scanner/src/seo/seoScore.ts` | Technical + content dimensions; blended into scan `score_overall` when enabled |

Rule catalog and fix guidance: `apps/scanner/src/seo/seoRuleCatalog.ts` (mirrored in web `apps/web/app/utils/seoRules.ts` for drawer copy).

---

## Data model

| Collection | Role |
|------------|------|
| `seo_issues` | Per-page or site-level findings linked to scan + page |
| `scans.score_seo` | Stored SEO score at scan completion (when SEO enabled) |

Issues use traffic-light severity in the UI (`TrafficLightDot`, `trafficLightStatus.ts`).

---

## Key web files

| Area | Path |
|------|------|
| Issue table + drawer | `components/seo/SeoIssueTable.vue`, `SeoIssueDetailDrawer.vue` |
| SERP preview API | `server/api/seo-meta-preview.get.ts` |
| SERP utils | `app/utils/serpPreview.ts` |
| Rescan single page | Issue drawers → queue partial scan; delta via `scanScoreDelta.ts` |

---

## Known gaps

| Gap | Notes |
|-----|-------|
| **Search Console** | No Google Search Console integration |
| **CSV export** | No SEO issue export |
| **`seo` policy category** | Policies module has no SEO rule type yet |
| **Historical resolved SEO** | No resolved/dismissed SEO workflow (open issues only) |

See [platform-status.md](../platform-status.md) for the full gap list.

---

## Related

- [product/scans.md](./scans.md) — crawl queue and finalize
- [product/scores.md](./scores.md) — how SEO blends into overall score
- [product/accessibility-site-target.md](./accessibility-site-target.md) — site settings pattern
- [design/ui-dictionary.md](../design/ui-dictionary.md) — nav labels
