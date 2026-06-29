import { describe, it, expect } from 'vitest'
import { compareTimestampsDesc, timestampSortKey } from '~/utils/sortTimestamps'

describe('sortTimestamps', () => {
  it('compareTimestampsDesc never throws on undefined values', () => {
    expect(() => compareTimestampsDesc(undefined, undefined)).not.toThrow()
    expect(compareTimestampsDesc(undefined, undefined)).toBe(0)
    expect(compareTimestampsDesc('2025-01-02', undefined)).toBeLessThan(0)
  })

  it('orders ISO strings newest first', () => {
    expect(compareTimestampsDesc('2025-01-01', '2025-01-02')).toBeGreaterThan(0)
    expect(compareTimestampsDesc('2025-01-02', '2025-01-01')).toBeLessThan(0)
  })

  it('timestampSortKey returns 0 for invalid input', () => {
    expect(timestampSortKey(undefined)).toBe(0)
    expect(timestampSortKey('not-a-date')).toBe(0)
  })
})
