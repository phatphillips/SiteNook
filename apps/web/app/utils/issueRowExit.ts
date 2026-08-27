/** Wait for a row exit animation before removing from the list. */
export const ISSUE_ROW_EXIT_MS = 280

export function issueRowKey(ruleId: string, siteId?: string): string {
  return siteId ? `${siteId}:${ruleId}` : ruleId
}

export function issuePageRowKey(ruleId: string, pageUrl: string, siteId?: string): string {
  const base = `${ruleId}::${pageUrl}`
  return siteId ? `${siteId}:${base}` : base
}

export function waitForIssueRowExit(ms = ISSUE_ROW_EXIT_MS): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
