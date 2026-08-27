import type { OrganizationPlan } from '~/types/sitenook'
import {
  getPlanLimits,
  normalizeOrganizationPlan,
  PAID_CHECKOUT_PLANS,
  type PaidCheckoutPlan
} from '~/utils/planLimits'
import { getPlanOffering } from '~/utils/planPricing'

export const PLAN_TIER_RANK: Record<OrganizationPlan, number> = {
  free: 0,
  starter: 1,
  team: 2,
  business: 3,
  enterprise: 4
}

export interface OrganizationPlanUsage {
  siteCount: number
  teamMemberCount: number
  scheduledSiteCount: number
  policyCount: number
  seoEnabledSiteCount: number
}

export type PlanChangeDirection = 'upgrade' | 'downgrade' | 'same'

export interface PlanChangeBlocker {
  id: string
  message: string
  remediation: string
  settingsPath?: string
}

export interface PlanChangeAssessment {
  targetPlan: PaidCheckoutPlan
  direction: PlanChangeDirection
  eligible: boolean
  blockers: PlanChangeBlocker[]
}

export function comparePlanTiers(
  current: OrganizationPlan,
  target: OrganizationPlan
): PlanChangeDirection {
  const currentRank = PLAN_TIER_RANK[normalizeOrganizationPlan(current)]
  const targetRank = PLAN_TIER_RANK[normalizeOrganizationPlan(target)]
  if (targetRank > currentRank) return 'upgrade'
  if (targetRank < currentRank) return 'downgrade'
  return 'same'
}

function buildBlockersForTarget(
  targetPlan: OrganizationPlan,
  usage: OrganizationPlanUsage
): PlanChangeBlocker[] {
  const limits = getPlanLimits(targetPlan)
  const blockers: PlanChangeBlocker[] = []
  const targetName = getPlanOffering(targetPlan)?.name ?? targetPlan

  if (usage.siteCount > limits.maxSites) {
    blockers.push({
      id: 'sites',
      message: `You have ${usage.siteCount} sites; ${targetName} allows up to ${limits.maxSites}.`,
      remediation: `Remove or archive ${usage.siteCount - limits.maxSites} site(s) before downgrading.`,
      settingsPath: '/sites'
    })
  }

  if (usage.teamMemberCount > limits.maxTeamMembers) {
    blockers.push({
      id: 'teamMembers',
      message: `You have ${usage.teamMemberCount} team members; ${targetName} allows up to ${limits.maxTeamMembers}.`,
      remediation: `Remove ${usage.teamMemberCount - limits.maxTeamMembers} member(s) from Settings → Team.`,
      settingsPath: '/settings/users'
    })
  }

  if (!limits.scheduledScans && usage.scheduledSiteCount > 0) {
    blockers.push({
      id: 'scheduledScans',
      message: `${usage.scheduledSiteCount} site(s) use scheduled scans, which are not included on ${targetName}.`,
      remediation: 'Open each site and switch crawl schedule to Manual only.',
      settingsPath: '/sites'
    })
  }

  if (!limits.seoModule && usage.seoEnabledSiteCount > 0) {
    blockers.push({
      id: 'seoModule',
      message: `SEO monitoring is enabled on ${usage.seoEnabledSiteCount} site(s); ${targetName} does not include SEO.`,
      remediation: 'Disable SEO checks in site settings (or turn off SEO scans) before downgrading.',
      settingsPath: '/sites'
    })
  }

  if (!limits.policies && usage.policyCount > 0) {
    blockers.push({
      id: 'policies',
      message: `You have ${usage.policyCount} custom content ${usage.policyCount === 1 ? 'policy' : 'policies'}; ${targetName} does not include policies.`,
      remediation: 'Delete unused policies under Policies before downgrading.',
      settingsPath: '/policies'
    })
  }

  return blockers
}

export function assessPlanChange(
  currentPlan: OrganizationPlan,
  targetPlan: PaidCheckoutPlan,
  usage: OrganizationPlanUsage
): PlanChangeAssessment {
  const normalizedCurrent = normalizeOrganizationPlan(currentPlan)
  const direction = comparePlanTiers(normalizedCurrent, targetPlan)
  const blockers = direction === 'downgrade'
    ? buildBlockersForTarget(targetPlan, usage)
    : []

  return {
    targetPlan,
    direction,
    eligible: direction !== 'downgrade' || blockers.length === 0,
    blockers
  }
}

export function buildPaidPlanChangeAssessments(
  currentPlan: OrganizationPlan,
  usage: OrganizationPlanUsage
): PlanChangeAssessment[] {
  return PAID_CHECKOUT_PLANS.map(targetPlan =>
    assessPlanChange(currentPlan, targetPlan, usage)
  )
}
