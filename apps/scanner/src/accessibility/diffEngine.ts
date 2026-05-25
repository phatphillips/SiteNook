export interface IssueFingerprint {
  rule_id: string
  css_selector: string
  page_url: string
}

export function fingerprint(issue: IssueFingerprint): string {
  return `${issue.page_url}::${issue.rule_id}::${issue.css_selector}`
}

export interface DiffResult {
  new_issues: number
  fixed_issues: number
  unchanged: number
  new_issue_ids: string[]
  fixed_issue_keys: string[]
}

export function diffScans(
  currentIssues: Array<IssueFingerprint & { id?: string }>,
  previousIssues: Array<IssueFingerprint & { id?: string }>
): DiffResult {
  const prevSet = new Set(previousIssues.map(fingerprint))
  const currSet = new Set(currentIssues.map(fingerprint))

  const newIssues = currentIssues.filter(i => !prevSet.has(fingerprint(i)))
  const fixedIssues = previousIssues.filter(i => !currSet.has(fingerprint(i)))

  return {
    new_issues: newIssues.length,
    fixed_issues: fixedIssues.length,
    unchanged: currentIssues.length - newIssues.length,
    new_issue_ids: newIssues.map(i => i.id || fingerprint(i)),
    fixed_issue_keys: fixedIssues.map(fingerprint)
  }
}
