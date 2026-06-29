import { describe, expect, it } from 'vitest'
import {
  historyCutoffMs,
  isScanWithinHistory,
  pickScanIdForRetention
} from '../../../src/db/scanRetention.js'

describe('scan history retention', () => {
  const now = new Date('2026-06-25T12:00:00Z')

  it('isScanWithinHistory respects scanHistoryDays', () => {
    const recent = {
      id: 'a',
      site: 's1',
      status: 'complete',
      completed_at: '2026-06-20T00:00:00Z'
    }
    const old = {
      id: 'b',
      site: 's1',
      status: 'complete',
      completed_at: '2026-01-01T00:00:00Z'
    }

    expect(isScanWithinHistory(recent, 30, now)).toBe(true)
    expect(isScanWithinHistory(old, 30, now)).toBe(false)
    expect(isScanWithinHistory(old, 365, now)).toBe(true)
  })

  it('historyCutoffMs subtracts full days', () => {
    const cutoff = historyCutoffMs(7, now)
    expect(cutoff).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  })

  it('pickScanIdForRetention includes complete_with_errors', () => {
    const id = pickScanIdForRetention([
      { id: 'ok', site: 's1', status: 'complete_with_errors', completed_at: '2026-06-01T00:00:00Z' },
      { id: 'older', site: 's1', status: 'complete', completed_at: '2026-01-01T00:00:00Z' }
    ])
    expect(id).toBe('ok')
  })
})
