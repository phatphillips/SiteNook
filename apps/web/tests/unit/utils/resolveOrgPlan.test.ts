import { describe, expect, it } from 'vitest'
import { resolvePlanFromSources } from '~/utils/resolveOrgPlan'

describe('resolveOrgPlan', () => {
  it('prefers tenant organization plan when present', () => {
    expect(resolvePlanFromSources({ plan: 'business' }, { plan: 'free' })).toBe('business')
  })

  it('falls back to user organization plan on apex hosts', () => {
    expect(resolvePlanFromSources(null, { plan: 'business' })).toBe('business')
    expect(resolvePlanFromSources({ plan: '' }, { plan: 'business' })).toBe('business')
  })

  it('defaults to free when no plan is available', () => {
    expect(resolvePlanFromSources(null, null)).toBe('free')
  })
})
