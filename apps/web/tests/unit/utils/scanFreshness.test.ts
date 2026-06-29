import { describe, it, expect } from 'vitest'
import { scanFreshness, scanFreshnessBadgeColor } from '~/utils/scanFreshness'

describe('scanFreshness', () => {
  it('returns fresh within 2 hours', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(scanFreshness(recent)).toBe('fresh')
    expect(scanFreshnessBadgeColor('fresh')).toBe('success')
  })

  it('returns stale between 2 and 12 hours', () => {
    const stale = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    expect(scanFreshness(stale)).toBe('stale')
    expect(scanFreshnessBadgeColor('stale')).toBe('warning')
  })

  it('returns old after 12 hours', () => {
    const old = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(scanFreshness(old)).toBe('old')
    expect(scanFreshnessBadgeColor('old')).toBe('error')
  })
})
