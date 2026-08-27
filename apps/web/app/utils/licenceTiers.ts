import {
  getPlanLimits,
  type PlanLimitSet,
  type OrganizationPlan
} from './planLimits'

/** Licence tiers stored on the `licences` collection. */
export const LICENCE_TIERS = ['community', 'selfhost', 'enterprise'] as const
export type LicenceTier = (typeof LICENCE_TIERS)[number]

/** Self-host paid unlock mirrors Business hosted limits. */
export const SELFHOST_PLAN_MIRROR: OrganizationPlan = 'business'

const TIER_TO_PLAN: Record<LicenceTier, OrganizationPlan> = {
  community: 'free',
  selfhost: SELFHOST_PLAN_MIRROR,
  enterprise: 'enterprise'
}

export function isLicenceTier(value: unknown): value is LicenceTier {
  return typeof value === 'string'
    && LICENCE_TIERS.includes(value.trim().toLowerCase() as LicenceTier)
}

export function normalizeLicenceTier(tier: unknown): LicenceTier {
  if (typeof tier !== 'string') return 'community'
  const trimmed = tier.trim().toLowerCase()
  if (isLicenceTier(trimmed)) return trimmed
  return 'community'
}

/** Map a licence tier to the organization plan used for limit checks. */
export function organizationPlanForLicenceTier(tier: unknown): OrganizationPlan {
  return TIER_TO_PLAN[normalizeLicenceTier(tier)]
}

export function getLicenceTierLimits(tier: unknown): PlanLimitSet {
  return getPlanLimits(organizationPlanForLicenceTier(tier))
}

/**
 * Effective appliance limits when no paid/enterprise licence is active.
 * Missing or invalid keys run as Community (Free caps).
 */
export function getApplianceEffectiveLimits(options: {
  licenceValid: boolean
  tier?: unknown
}): PlanLimitSet {
  if (!options.licenceValid) {
    return getPlanLimits('free')
  }
  return getLicenceTierLimits(options.tier)
}

export function isFullSelfHostTier(tier: unknown): boolean {
  const normalized = normalizeLicenceTier(tier)
  return normalized === 'selfhost' || normalized === 'enterprise'
}
