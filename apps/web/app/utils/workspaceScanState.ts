import type { Scan } from '~/types/sitenook'
import { TERMINAL_SCAN_STATUSES } from '~/utils/scanDisplay'

export type WorkspaceScanState =
  | 'idle'
  | 'scanning'
  | 'queued'
  | 'scanned'
  | 'failed'
  | 'never-scanned'

export function isWorkspaceScanSuccess(status: string): boolean {
  return status === 'complete'
}

export function isWorkspaceScanFailure(status: string): boolean {
  return status === 'failed'
    || status === 'cancelled'
    || status === 'complete_with_errors'
}

export function deriveWorkspaceScanState(input: {
  siteId?: string
  isQueued: boolean
  isRunning: boolean
  lastTerminalScan: Scan | null
}): WorkspaceScanState {
  if (!input.siteId) return 'idle'
  if (input.isRunning) return 'scanning'
  if (input.isQueued) return 'queued'
  if (!input.lastTerminalScan) return 'never-scanned'
  if (isWorkspaceScanSuccess(input.lastTerminalScan.status)) return 'scanned'
  if (isWorkspaceScanFailure(input.lastTerminalScan.status)) return 'failed'
  return 'never-scanned'
}

export function workspaceScanStateLabel(state: WorkspaceScanState): string {
  switch (state) {
    case 'scanning': return 'Scanning…'
    case 'queued': return 'Queued'
    case 'scanned': return 'Up to date'
    case 'failed': return 'Last scan failed'
    case 'never-scanned': return 'Never scanned'
    default: return 'Select a site'
  }
}

export function workspaceScanStateEyebrow(input: {
  state: WorkspaceScanState
  workspaceName: string
}): string {
  const { state, workspaceName } = input
  if (state === 'scanning' || state === 'queued' || state === 'failed' || state === 'never-scanned') {
    return workspaceScanStateLabel(state)
  }
  return workspaceName
}

export function workspaceScanStateEyebrowClass(state: WorkspaceScanState): string {
  switch (state) {
    case 'scanning': return 'workspace-switcher-eyebrow--scanning'
    case 'queued': return 'workspace-switcher-eyebrow--queued'
    case 'scanned': return 'workspace-switcher-eyebrow--scanned'
    case 'failed':
    case 'never-scanned': return 'workspace-switcher-eyebrow--warning'
    default: return ''
  }
}

export function formatWorkspaceScanTooltip(input: {
  state: WorkspaceScanState
  siteName: string
  runningScan: Scan | null
  lastTerminalScan: Scan | null
  formatRelativeTime: (iso: string) => string
}): string {
  const { state, siteName, runningScan, lastTerminalScan, formatRelativeTime } = input

  switch (state) {
    case 'idle':
      return 'Select a site to view scan status'
    case 'scanning': {
      const pages = runningScan?.pages_crawled ?? 0
      const pagesLabel = pages > 0 ? ` · ${pages} page${pages === 1 ? '' : 's'} crawled` : ''
      return `Scanning ${siteName}…${pagesLabel}`
    }
    case 'queued':
      return `Scan queued for ${siteName} · waiting to start`
    case 'scanned': {
      const ts = lastTerminalScan?.completed_at ?? lastTerminalScan?.created
      const when = ts ? formatRelativeTime(ts) : 'recently'
      const pages = lastTerminalScan?.pages_crawled
      const pagesLabel = pages != null && pages > 0 ? ` · ${pages} pages` : ''
      return `Last scan succeeded ${when}${pagesLabel}`
    }
    case 'failed': {
      const ts = lastTerminalScan?.completed_at ?? lastTerminalScan?.created
      const when = ts ? formatRelativeTime(ts) : 'recently'
      return `Last scan did not complete successfully · ${when}`
    }
    case 'never-scanned':
      return `${siteName} has not been scanned yet`
    default:
      return workspaceScanStateLabel(state)
  }
}

export { TERMINAL_SCAN_STATUSES }
