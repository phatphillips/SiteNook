import { describe, it, expect } from 'vitest'
import type { Scan } from '~/types/sitenook'
import { pickLatestTerminalScan } from '~/utils/workspaceScanQuery'

function scan(status: Scan['status'], id: string, completed_at: string): Scan {
  return {
    id,
    site: 'site-1',
    status,
    scan_type: 'full',
    pages_crawled: 1,
    completed_at
  }
}

describe('pickLatestTerminalScan', () => {
  it('returns the newest terminal scan by timestamp', () => {
    const result = pickLatestTerminalScan([
      scan('complete', 'old', '2026-01-01T00:00:00Z'),
      scan('failed', 'newer-failed', '2026-06-01T00:00:00Z'),
      scan('running', 'ignore', '2026-12-01T00:00:00Z')
    ])
    expect(result?.id).toBe('newer-failed')
  })

  it('returns null when no terminal scans exist', () => {
    expect(pickLatestTerminalScan([
      scan('running', 'run', '2026-06-01T00:00:00Z')
    ])).toBeNull()
  })
})
