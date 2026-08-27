import type { DismissReason } from '~/utils/issueActions'

export type A11yIssueActionType = 'dismissed' | 'fixed' | 'reopened'
export type A11yIssueActionScope = 'rule' | 'page'

export interface A11yIssueActionEntry {
  id: string
  organization: string
  site: string
  actor?: string
  action: A11yIssueActionType
  scope: A11yIssueActionScope
  rule_id: string
  description?: string
  impact?: 'critical' | 'serious' | 'moderate' | 'minor'
  wcag_level?: 'A' | 'AA' | 'AAA'
  page_url?: string
  page_title?: string
  dismiss_reason?: DismissReason | string
  issue_ids?: string[]
  logged_at: string
  expand?: {
    actor?: { id: string, name?: string, email?: string }
    site?: { id: string, name?: string }
  }
}

export interface A11yIssueActionCreateInput {
  organization: string
  site: string
  actor?: string
  action: A11yIssueActionType
  scope: A11yIssueActionScope
  rule_id: string
  description?: string
  impact?: string
  wcag_level?: string
  page_url?: string
  page_title?: string
  dismiss_reason?: string
  issue_ids?: string[]
  logged_at?: string
}

export interface A11yIssueActionMeta {
  label: string
  icon: string
  color: 'success' | 'warning' | 'neutral' | 'info' | 'error'
}

const DISMISS_REASON_LABELS: Record<string, string> = {
  wont_fix: 'Won\'t fix',
  false_positive: 'False positive',
  defer: 'Deferred'
}

export function getA11yIssueActionMeta(action: string): A11yIssueActionMeta {
  switch (action) {
    case 'fixed':
      return { label: 'Marked fixed', icon: 'i-lucide-check', color: 'success' }
    case 'reopened':
      return { label: 'Reopened', icon: 'i-lucide-rotate-ccw', color: 'info' }
    case 'dismissed':
    default:
      return { label: 'Dismissed', icon: 'i-lucide-x', color: 'neutral' }
  }
}

export function formatA11yDismissReason(reason?: string | null): string | null {
  if (!reason) return null
  return DISMISS_REASON_LABELS[reason] ?? reason
}

export function formatA11yIssueActionTimestamp(entry: A11yIssueActionEntry): string {
  const ms = Date.parse(entry.logged_at)
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatA11yIssueActionActor(entry: A11yIssueActionEntry): string {
  const actor = entry.expand?.actor
  if (actor?.name?.trim()) return actor.name.trim()
  if (actor?.email?.trim()) return actor.email.trim()
  return 'Someone'
}

export function formatA11yIssueActionSentence(entry: A11yIssueActionEntry): string {
  const actor = formatA11yIssueActionActor(entry)
  const meta = getA11yIssueActionMeta(entry.action)
  const scope = entry.scope === 'page' ? 'on a page' : 'for this issue type'
  return `${actor} ${meta.label.toLowerCase()} ${scope}`
}

export function formatA11yIssueActionDetail(entry: A11yIssueActionEntry): string | null {
  const parts: string[] = []
  const reason = formatA11yDismissReason(entry.dismiss_reason)
  if (reason) parts.push(`Reason: ${reason}`)
  if (entry.page_url) {
    parts.push(entry.page_title?.trim() || entry.page_url)
  }
  const count = entry.issue_ids?.length ?? 0
  if (count > 1) parts.push(`${count} occurrences`)
  return parts.length ? parts.join(' · ') : null
}

export function reopenIssuePatch(): Record<string, unknown> {
  return {
    status: 'open',
    dismissed_at: null,
    dismiss_reason: '',
    dismissed_by: null
  }
}
