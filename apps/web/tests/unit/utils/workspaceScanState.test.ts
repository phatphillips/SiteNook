import { describe, it, expect } from 'vitest'
import type { Scan } from '~/types/sitenook'
import {
  deriveWorkspaceScanState,
  formatWorkspaceScanTooltip,
  isWorkspaceScanFailure,
  isWorkspaceScanSuccess,
  workspaceScanStateEyebrow
} from '~/utils/workspaceScanState'

function scan(status: Scan['status']): Scan {
  return {
    id: 'scan-1',
    site: 'site-1',
    status,
    scan_type: 'full',
    pages_crawled: 10,
    completed_at: '2026-01-01T12:00:00Z'
  }
}

describe('workspaceScanState', () => {
  it('prioritizes scanning over queued and terminal', () => {
    expect(deriveWorkspaceScanState({
      siteId: 'site-1',
      isQueued: true,
      isRunning: true,
      lastTerminalScan: scan('complete')
    })).toBe('scanning')
  })

  it('shows scanning when queue is processing even without a running scan record', () => {
    expect(deriveWorkspaceScanState({
      siteId: 'site-1',
      isQueued: false,
      isRunning: true,
      lastTerminalScan: scan('complete')
    })).toBe('scanning')
  })

  it('shows queued when pending and not running', () => {
    expect(deriveWorkspaceScanState({
      siteId: 'site-1',
      isQueued: true,
      isRunning: false,
      lastTerminalScan: scan('complete')
    })).toBe('queued')
  })

  it('shows scanned for success-only complete terminal scan', () => {
    expect(deriveWorkspaceScanState({
      siteId: 'site-1',
      isQueued: false,
      isRunning: false,
      lastTerminalScan: scan('complete')
    })).toBe('scanned')
  })

  it('shows failed for failed, cancelled, and complete_with_errors', () => {
    for (const status of ['failed', 'cancelled', 'complete_with_errors'] as const) {
      expect(deriveWorkspaceScanState({
        siteId: 'site-1',
        isQueued: false,
        isRunning: false,
        lastTerminalScan: scan(status)
      })).toBe('failed')
    }
  })

  it('shows never-scanned when idle with no terminal scan', () => {
    expect(deriveWorkspaceScanState({
      siteId: 'site-1',
      isQueued: false,
      isRunning: false,
      lastTerminalScan: null
    })).toBe('never-scanned')
  })

  it('classifies success and failure helpers', () => {
    expect(isWorkspaceScanSuccess('complete')).toBe(true)
    expect(isWorkspaceScanSuccess('failed')).toBe(false)
    expect(isWorkspaceScanFailure('failed')).toBe(true)
    expect(isWorkspaceScanFailure('complete')).toBe(false)
  })

  it('formats tooltip for scanning with page count', () => {
    const text = formatWorkspaceScanTooltip({
      state: 'scanning',
      siteName: 'Example',
      runningScan: scan('running'),
      lastTerminalScan: null,
      formatRelativeTime: () => 'recently'
    })
    expect(text).toContain('Scanning Example')
    expect(text).toContain('10 pages')
  })

  it('uses status eyebrow when scanning and org name when scanned', () => {
    expect(workspaceScanStateEyebrow({ state: 'scanning', workspaceName: 'Monkey' })).toBe('Scanning…')
    expect(workspaceScanStateEyebrow({ state: 'scanned', workspaceName: 'Monkey' })).toBe('Monkey')
  })
})
