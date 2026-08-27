import { describe, expect, it } from 'vitest'
import {
  buildTeamTrialProvisionFields,
  isAppManagedTrial,
  isTrialExpired,
  resolveTrialNudgeStage
} from '../../../server/utils/teamTrial'

describe('teamTrial', () => {
  it('builds Team trial provision fields', () => {
    const from = new Date('2026-01-01T00:00:00.000Z')
    const fields = buildTeamTrialProvisionFields(from)
    expect(fields.plan).toBe('team')
    expect(fields.subscription_status).toBe('trialing')
    expect(fields.trial_ends_at).toBe('2026-01-31T00:00:00.000Z')
    expect(fields.trial_nudge_stage).toBe(0)
  })

  it('detects app-managed trials', () => {
    expect(isAppManagedTrial({
      subscription_status: 'trialing',
      trial_ends_at: '2026-02-01T00:00:00.000Z',
      stripe_subscription_id: ''
    })).toBe(true)
    expect(isAppManagedTrial({
      subscription_status: 'trialing',
      trial_ends_at: '2026-02-01T00:00:00.000Z',
      stripe_subscription_id: 'sub_123'
    })).toBe(false)
  })

  it('detects trial expiry', () => {
    expect(isTrialExpired('2026-01-01T00:00:00.000Z', new Date('2026-01-02T00:00:00.000Z'))).toBe(true)
    expect(isTrialExpired('2026-01-10T00:00:00.000Z', new Date('2026-01-02T00:00:00.000Z'))).toBe(false)
  })

  it('resolves day-N nudge stages', () => {
    expect(resolveTrialNudgeStage(7, 0)).toBe(7)
    expect(resolveTrialNudgeStage(3, 7)).toBe(3)
    expect(resolveTrialNudgeStage(1, 3)).toBe(1)
    expect(resolveTrialNudgeStage(0, 1)).toBe(-1)
    expect(resolveTrialNudgeStage(10, 0)).toBe(null)
  })
})
