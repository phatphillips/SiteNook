/**
 * Licence tiers mirror apps/web/app/utils/licenceTiers.ts — keep in sync.
 */
import {
  getPlanLimits,
  type OrganizationPlan,
  type PlanLimitSet
} from './planLimits.js'

export const LICENCE_TIERS = ['community', 'selfhost', 'enterprise'] as const
export type LicenceTier = (typeof LICENCE_TIERS)[number]

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

export function organizationPlanForLicenceTier(tier: unknown): OrganizationPlan {
  return TIER_TO_PLAN[normalizeLicenceTier(tier)]
}

export function getLicenceTierLimits(tier: unknown): PlanLimitSet {
  return getPlanLimits(organizationPlanForLicenceTier(tier))
}

export function getApplianceEffectivePlan(options: {
  licenceValid: boolean
  tier?: unknown
}): OrganizationPlan {
  if (!options.licenceValid) return 'free'
  return organizationPlanForLicenceTier(options.tier)
}

export function isFullSelfHostTier(tier: unknown): boolean {
  const normalized = normalizeLicenceTier(tier)
  return normalized === 'selfhost' || normalized === 'enterprise'
}
