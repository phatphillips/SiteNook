import { describe, expect, it } from 'vitest'
import type { Scan } from '~/types/accessiq'
import {
  formatScanChangesCompact,
  formatScanDiffDetail,
  formatScanDiffLine,
  formatScanLogLine,
  formatScanRunSummary
} from '~/utils/scanLog'

const baseScan: Scan = {
  id: 's1',
  site: 'site1',
  status: 'complete',
  scan_type: 'full',
  pages_crawled: 15
}

describe('formatScanLogLine', () => {
  it('formats completed scan with page count', () => {
    expect(formatScanLogLine(baseScan)).toBe('Completed · 15 pages')
  })

  it('includes error message for failed scans', () => {
    const scan: Scan = {
      ...baseScan,
      status: 'failed',
      pages_crawled: 0,
      error_message: 'Could not connect to host'
    }
    expect(formatScanLogLine(scan)).toBe('Failed · 0 pages · Could not connect to host')
  })

  it('shows running progress', () => {
    const scan: Scan = { ...baseScan, status: 'running', pages_crawled: 160 }
    expect(formatScanLogLine(scan)).toBe('Running · 160 pages')
  })
})

describe('formatScanDiffLine', () => {
  it('formats diff summary for completed scans', () => {
    const scan: Scan = {
      ...baseScan,
      diff_summary: { new_issues: 5, fixed_issues: 3, unchanged: 10 }
    }
    expect(formatScanDiffLine(scan)).toBe('3 fixed, 5 new')
  })

  it('returns null when no diff', () => {
    expect(formatScanDiffLine(baseScan)).toBeNull()
  })
})

describe('formatScanRunSummary', () => {
  it('combines pages and diff without status label', () => {
    const scan: Scan = {
      ...baseScan,
      diff_summary: { new_issues: 8, fixed_issues: 2, unchanged: 10 }
    }
    expect(formatScanRunSummary(scan)).toBe('15 pages · 2 fixed, 8 new')
  })

  it('includes error message for failed scans', () => {
    const scan: Scan = {
      ...baseScan,
      status: 'failed',
      pages_crawled: 0,
      error_message: 'Could not connect to host'
    }
    expect(formatScanRunSummary(scan)).toBe('0 pages · Could not connect to host')
  })
})

describe('formatScanChangesCompact', () => {
  it('formats compact diff for detail card', () => {
    const scan: Scan = {
      ...baseScan,
      diff_summary: { new_issues: 8, fixed_issues: 2, unchanged: 10 }
    }
    expect(formatScanChangesCompact(scan)).toBe('2 fixed · 8 new issues')
  })
})

describe('formatScanDiffDetail', () => {
  it('formats full diff breakdown', () => {
    const scan: Scan = {
      ...baseScan,
      diff_summary: { new_issues: 5, fixed_issues: 3, unchanged: 10 }
    }
    expect(formatScanDiffDetail(scan)).toBe(
      '3 issues fixed since last scan · 5 new issues · 10 unchanged'
    )
  })
})
