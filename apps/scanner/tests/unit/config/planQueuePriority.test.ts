import { describe, expect, it } from 'vitest'
import { queuePriorityForPlan } from '../../../src/config/planQueuePriority.js'

describe('queuePriorityForPlan', () => {
  it('ranks paid tiers above free', () => {
    expect(queuePriorityForPlan('enterprise')).toBeGreaterThan(queuePriorityForPlan('business'))
    expect(queuePriorityForPlan('business')).toBeGreaterThan(queuePriorityForPlan('team'))
    expect(queuePriorityForPlan('team')).toBeGreaterThan(queuePriorityForPlan('starter'))
    expect(queuePriorityForPlan('starter')).toBeGreaterThan(queuePriorityForPlan('free'))
  })

  it('normalizes legacy standard alias via plan limits', () => {
    expect(queuePriorityForPlan('standard')).toBe(queuePriorityForPlan('team'))
  })
})
