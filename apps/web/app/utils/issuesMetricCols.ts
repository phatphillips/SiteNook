/** Shared unfrozen metric column widths for IssuesTable + IssueAffectedPagesTable. */
export const ISSUES_EXPAND_COL_REM = 2.75
/** Comfortable reading width for issue titles in the frozen rail. */
export const ISSUES_ISSUE_COL_MIN_REM = 28
export const ISSUES_FROZEN_RAIL_MIN_REM = ISSUES_EXPAND_COL_REM + ISSUES_ISSUE_COL_MIN_REM
export const ISSUES_METRIC_COL = {
  site: 'issues-metric-col issues-metric-col--site whitespace-nowrap truncate',
  level: 'issues-metric-col issues-metric-col--level issues-table-center-col text-center whitespace-nowrap',
  wcag_sc: 'issues-metric-col issues-metric-col--sc issues-table-center-col text-center whitespace-nowrap',
  target_category: 'issues-metric-col issues-metric-col--type issues-table-center-col text-center whitespace-nowrap',
  responsible_role: 'issues-metric-col issues-metric-col--role issues-table-center-col text-center whitespace-nowrap',
  element_type: 'issues-metric-col issues-metric-col--element issues-table-center-col text-center whitespace-nowrap',
  severity: 'issues-metric-col issues-metric-col--severity issues-table-center-col text-center whitespace-nowrap',
  pages: 'issues-metric-col issues-metric-col--pages issues-table-center-col text-center tabular-nums whitespace-nowrap',
  occurrences: 'issues-metric-col issues-metric-col--occurrences issues-table-center-col text-center tabular-nums whitespace-nowrap',
  points: 'issues-metric-col issues-metric-col--points issues-table-center-col text-center tabular-nums whitespace-nowrap',
  status: 'issues-metric-col issues-metric-col--status issues-table-center-col text-center whitespace-nowrap',
  actions: 'issues-metric-col issues-metric-col--actions text-right'
} as const
