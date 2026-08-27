import { TEAM_TRIAL_DAYS, computeTrialEndsAt, daysRemainingUntil } from '~/utils/planPricing'

export { TEAM_TRIAL_DAYS, computeTrialEndsAt, daysRemainingUntil }

export type TrialNudgeStage = 0 | 7 | 3 | 1 | -1

export function isAppManagedTrial(org: {
  subscription_status?: string | null
  trial_ends_at?: string | null
  stripe_subscription_id?: string | null
}): boolean {
  return org.subscription_status === 'trialing'
    && Boolean(org.trial_ends_at?.trim())
    && !org.stripe_subscription_id?.trim()
}

export function isTrialExpired(
  trialEndsAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!trialEndsAt?.trim()) return false
  const end = new Date(trialEndsAt)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() <= now.getTime()
}

/** Which day-N nudge should fire given days remaining (7, 3, 1). */
export function resolveTrialNudgeStage(
  daysRemaining: number | null,
  currentStage: number | null | undefined
): TrialNudgeStage | null {
  if (daysRemaining === null) return null
  const stage = currentStage ?? 0
  const already = new Set([stage])

  if (daysRemaining <= 0) {
    return stage === -1 ? null : -1
  }
  if (daysRemaining <= 1 && !already.has(1) && stage !== -1) return 1
  if (daysRemaining <= 3 && daysRemaining > 1 && !already.has(3) && !already.has(1) && stage !== -1) {
    return 3
  }
  if (daysRemaining <= 7 && daysRemaining > 3 && !already.has(7) && !already.has(3) && !already.has(1) && stage !== -1) {
    return 7
  }
  return null
}

export function buildTrialDowngradePayload(): Record<string, unknown> {
  return {
    plan: 'free',
    subscription_status: 'none',
    trial_ends_at: null,
    trial_nudge_stage: -1
  }
}

export function buildTeamTrialProvisionFields(from: Date = new Date()): Record<string, unknown> {
  return {
    plan: 'team',
    subscription_status: 'trialing',
    trial_ends_at: computeTrialEndsAt(from, TEAM_TRIAL_DAYS),
    trial_nudge_stage: 0,
    onboarding_state: {
      dismissed: false,
      siteAdded: false,
      firstScanStarted: false,
      ahaSeen: false,
      teammateInvited: false,
      scheduleEnabled: false
    }
  }
}
