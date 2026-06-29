import { describe, expect, it } from 'vitest'
import {
  pickScanIdForRetention,
  summarizeScanError
} from '../../../src/db/scanRetention.js'

describe('summarizeScanError', () => {
  it('trims and collapses whitespace', () => {
    expect(summarizeScanError('  Could not\nreach   host  ')).toBe('Could not reach host')
  })

  it('truncates long messages', () => {
    const long = 'x'.repeat(250)
    const result = summarizeScanError(long, 50)
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns default when empty', () => {
    expect(summarizeScanError('   ')).toBe('Could not complete scan')
  })

  it('strips redundant scan failed prefix', () => {
    expect(summarizeScanError('Scan failed: Could not reach host')).toBe('Could not reach host')
  })
})

describe('pickScanIdForRetention', () => {
  it('picks the latest completed scan', () => {
    const id = pickScanIdForRetention([
      { id: 'old', site: 's1', status: 'complete', completed_at: '2026-01-01T00:00:00Z' },
      { id: 'new', site: 's1', status: 'complete', completed_at: '2026-06-01T00:00:00Z' },
      { id: 'fail', site: 's1', status: 'failed', completed_at: '2026-07-01T00:00:00Z' }
    ])
    expect(id).toBe('new')
  })

  it('returns null when no completed scan exists', () => {
    expect(
      pickScanIdForRetention([
        { id: 'f1', site: 's1', status: 'failed', completed_at: '2026-06-01T00:00:00Z' }
      ])
    ).toBeNull()
  })
})
