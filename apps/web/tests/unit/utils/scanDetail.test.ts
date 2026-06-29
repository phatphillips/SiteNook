import { describe, expect, it } from 'vitest'
import type { Scan } from '~/types/accessiq'
import {
  formatDiffFingerprintLine,
  formatScanModalTitle,
  formatScanTypeLabel,
  scanDiffFixedLines,
  scanSiteUrl
} from '~/utils/scanDetail'

const baseScan: Scan = {
  id: 's1',
  site: 'site1',
  status: 'complete',
  scan_type: 'full',
  pages_crawled: 15,
  completed_at: '2026-05-31T14:30:00.000Z',
  expand: {
    site: {
      id: 'site1',
      name: 'Example site',
      url: 'https://example.com'
    }
  }
}

describe('scanDetail utils', () => {
  it('formatScanModalTitle includes site name and long local date format', () => {
    const title = formatScanModalTitle(baseScan)
    expect(title).toMatch(/^Example site scan summary - /)
    expect(title).toMatch(/\d{1,2} \w+ 2026/)
    expect(title).toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })

  it('scanSiteUrl returns registered site URL from expand', () => {
    expect(scanSiteUrl(baseScan)).toBe('https://example.com')
    expect(scanSiteUrl({ ...baseScan, expand: undefined })).toBeNull()
  })

  it('formatScanTypeLabel humanizes scan type', () => {
    expect(formatScanTypeLabel('accessibility_only')).toBe('Accessibility Only')
  })

  it('formatDiffFingerprintLine parses stored keys', () => {
    const line = formatDiffFingerprintLine('https://example.com::color-contrast::.btn')
    expect(line).toContain('color-contrast')
    expect(line).toContain('https://example.com')
  })

  it('scanDiffFixedLines falls back to count when keys missing', () => {
    const scan: Scan = {
      ...baseScan,
      diff_summary: { new_issues: 0, fixed_issues: 2, unchanged: 5 }
    }
    expect(scanDiffFixedLines(scan)).toEqual(['2 issues fixed (details not stored)'])
  })
})
