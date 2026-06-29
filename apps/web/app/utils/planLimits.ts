import type { OrganizationPlan } from '~/types/accessiq'

export const ORGANIZATION_PLANS: OrganizationPlan[] = [
  'free',
  'starter',
  'team',
  'business',
  'enterprise'
]

export const PAID_CHECKOUT_PLANS = ['starter', 'team', 'business'] as const
export type PaidCheckoutPlan = typeof PAID_CHECKOUT_PLANS[number]

export type PlanFeature = 'scheduledScans' | 'seoModule' | 'policies' | 'inventory' | 'pdfAccessibility'

export interface PlanLimitSet {
  maxSites: number
  maxPagesPerScan: number
  maxTeamMembers: number
  scanHistoryDays: number
  scheduledScans: boolean
  seoModule: boolean
  policies: boolean
  inventory: boolean
  pdfAccessibility: boolean
}

const UNLIMITED_SITES = 999_999
const UNLIMITED_PAGES = 50_000
const UNLIMITED_MEMBERS = 999_999

export const PLAN_LIMITS: Record<OrganizationPlan, PlanLimitSet> = {
  free: {
    maxSites: 1,
    maxPagesPerScan: 100,
    maxTeamMembers: 2,
    scanHistoryDays: 7,
    scheduledScans: false,
    seoModule: false,
    policies: false,
    inventory: false,
    pdfAccessibility: false
  },
  starter: {
    maxSites: 3,
    maxPagesPerScan: 500,
    maxTeamMembers: 2,
    scanHistoryDays: 7,
    scheduledScans: false,
    seoModule: false,
    policies: false,
    inventory: false,
    pdfAccessibility: false
  },
  team: {
    maxSites: 10,
    maxPagesPerScan: 1_500,
    maxTeamMembers: 10,
    scanHistoryDays: 30,
    scheduledScans: true,
    seoModule: true,
    policies: false,
    inventory: false,
    pdfAccessibility: false
  },
  business: {
    maxSites: 25,
    maxPagesPerScan: 5_000,
    maxTeamMembers: 50,
    scanHistoryDays: 90,
    scheduledScans: true,
    seoModule: true,
    policies: true,
    inventory: true,
    pdfAccessibility: true
  },
  enterprise: {
    maxSites: UNLIMITED_SITES,
    maxPagesPerScan: UNLIMITED_PAGES,
    maxTeamMembers: UNLIMITED_MEMBERS,
    scanHistoryDays: 365,
    scheduledScans: true,
    seoModule: true,
    policies: true,
    inventory: true,
    pdfAccessibility: true
  }
}

const LEGACY_PLAN_ALIASES: Record<string, OrganizationPlan> = {
  standard: 'team'
}

export function normalizeOrganizationPlan(plan: unknown): OrganizationPlan {
  if (typeof plan !== 'string') return 'free'
  const trimmed = plan.trim().toLowerCase()
  if (trimmed in LEGACY_PLAN_ALIASES) {
    return LEGACY_PLAN_ALIASES[trimmed]!
  }
  if (ORGANIZATION_PLANS.includes(trimmed as OrganizationPlan)) {
    return trimmed as OrganizationPlan
  }
  return 'free'
}

export function isOrganizationPlan(value: unknown): value is OrganizationPlan {
  if (typeof value !== 'string') return false
  const trimmed = value.trim().toLowerCase()
  if (trimmed in LEGACY_PLAN_ALIASES) return true
  return ORGANIZATION_PLANS.includes(trimmed as OrganizationPlan)
}

export function isPaidCheckoutPlan(value: unknown): value is PaidCheckoutPlan {
  return typeof value === 'string'
    && PAID_CHECKOUT_PLANS.includes(value as PaidCheckoutPlan)
}

export function getPlanLimits(plan: unknown): PlanLimitSet {
  return PLAN_LIMITS[normalizeOrganizationPlan(plan)]
}

export function planHasFeature(plan: unknown, feature: PlanFeature): boolean {
  const limits = getPlanLimits(plan)
  return limits[feature]
}

export function formatPlanPrimaryMetric(plan: OrganizationPlan): string {
  const limits = PLAN_LIMITS[plan]
  if (plan === 'enterprise') {
    return 'Custom sites & scan limits'
  }
  const sites = limits.maxSites >= UNLIMITED_SITES
    ? 'Unlimited sites'
    : `${limits.maxSites} site${limits.maxSites === 1 ? '' : 's'}`
  const pages = limits.maxPagesPerScan >= UNLIMITED_PAGES
    ? 'custom pages/scan'
    : `${limits.maxPagesPerScan.toLocaleString()} pages/scan`
  return `${sites} · ${pages}`
}

export function describePlanLimitExceeded(
  kind: 'sites' | 'teamMembers' | 'scheduledScans' | 'seoModule' | 'policies',
  plan: unknown
): string {
  const normalized = normalizeOrganizationPlan(plan)
  const offeringName = normalized.charAt(0).toUpperCase() + normalized.slice(1)
  switch (kind) {
    case 'sites':
      return `Your ${offeringName} plan allows up to ${getPlanLimits(plan).maxSites} site(s). Upgrade to add more.`
    case 'teamMembers':
      return `Your ${offeringName} plan allows up to ${getPlanLimits(plan).maxTeamMembers} team member(s). Upgrade to invite more.`
    case 'scheduledScans':
      return 'Scheduled scans are available on Team plans and above.'
    case 'seoModule':
      return 'SEO monitoring is available on Team plans and above.'
    case 'policies':
      return 'Custom content policies are available on Business plans and above.'
    default:
      return 'This feature is not included in your current plan.'
  }
}
