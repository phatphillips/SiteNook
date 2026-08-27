/** Page fields for accessibility list loads — omit html_snapshot; include expand.scan timestamps for latest-page selection. */
export const A11Y_PAGE_FIELDS =
  'id,url,title,scan,site,expand.scan.completed_at,expand.scan.started_at,expand.scan.created'

/** Issue fields for list/overview — omit html_snippet and fix_suggestion (load on drawer open). */
export const A11Y_ISSUE_LIST_FIELDS =
  'id,scan,page,rule_id,wcag_level,wcag_sc,wcag_version,impact,type,element_type,responsible_role,help_url,description,css_selector,status,dismissed_at,dismiss_reason,updated,created'

export const A11Y_SCAN_LIST_FIELDS =
  'id,site,status,started_at,completed_at,created,score_overall,score_a,score_aa,score_aaa,score_best_practices,score_qa,score_denominators,a11y_check_stats,open_issue_count,pages_crawled,scan_quality'

/** PocketBase OR filter batches (avoid oversized filter strings). */
export const A11Y_PAGE_ID_BATCH_SIZE = 80

export function pbOrPageIds(pageIds: string[]): string {
  return pageIds.map(id => `page = "${id}"`).join(' || ')
}

export function chunkPageIds(pageIds: string[], batchSize = A11Y_PAGE_ID_BATCH_SIZE): string[][] {
  const batches: string[][] = []
  for (let i = 0; i < pageIds.length; i += batchSize) {
    batches.push(pageIds.slice(i, i + batchSize))
  }
  return batches
}
