import { PLAN_LIMITS } from '~/utils/planLimits'

export type PricingComparisonColumn = 'starter' | 'team' | 'business' | 'enterprise'

export interface PricingComparisonRow {
  feature: string
  starter: string
  team: string
  business: string
  enterprise: string
}

const UNLIMITED_SITES = 999_999
const UNLIMITED_PAGES = 50_000
const UNLIMITED_MEMBERS = 999_999

function formatSites(plan: PricingComparisonColumn): string {
  const max = PLAN_LIMITS[plan].maxSites
  if (max >= UNLIMITED_SITES) return 'Custom / unlimited'
  return String(max)
}

function formatPages(plan: PricingComparisonColumn): string {
  const max = PLAN_LIMITS[plan].maxPagesPerScan
  if (max >= UNLIMITED_PAGES) return 'Custom'
  return max.toLocaleString()
}

function formatMembers(plan: PricingComparisonColumn): string {
  const max = PLAN_LIMITS[plan].maxTeamMembers
  if (max >= UNLIMITED_MEMBERS) return 'Custom / unlimited'
  return String(max)
}

function formatHistory(plan: PricingComparisonColumn): string {
  return `${PLAN_LIMITS[plan].scanHistoryDays} days`
}

function yesNo(value: boolean): string {
  return value ? 'Included' : '—'
}

/** Feature matrix for the public pricing comparison table (derived from PLAN_LIMITS). */
export function buildPricingComparisonRows(): PricingComparisonRow[] {
  return [
    {
      feature: 'Sites',
      starter: formatSites('starter'),
      team: formatSites('team'),
      business: formatSites('business'),
      enterprise: formatSites('enterprise')
    },
    {
      feature: 'Pages per scan',
      starter: formatPages('starter'),
      team: formatPages('team'),
      business: formatPages('business'),
      enterprise: formatPages('enterprise')
    },
    {
      feature: 'Team members',
      starter: formatMembers('starter'),
      team: formatMembers('team'),
      business: formatMembers('business'),
      enterprise: formatMembers('enterprise')
    },
    {
      feature: 'Scan history',
      starter: formatHistory('starter'),
      team: formatHistory('team'),
      business: formatHistory('business'),
      enterprise: formatHistory('enterprise')
    },
    {
      feature: 'WCAG accessibility scans',
      starter: 'Included',
      team: 'Included',
      business: 'Included',
      enterprise: 'Included'
    },
    {
      feature: 'QA (broken links + spelling)',
      starter: 'Included',
      team: 'Included',
      business: 'Included',
      enterprise: 'Included'
    },
    {
      feature: 'Scheduled scans',
      starter: yesNo(PLAN_LIMITS.starter.scheduledScans),
      team: yesNo(PLAN_LIMITS.team.scheduledScans),
      business: yesNo(PLAN_LIMITS.business.scheduledScans),
      enterprise: yesNo(PLAN_LIMITS.enterprise.scheduledScans)
    },
    {
      feature: 'SEO module',
      starter: yesNo(PLAN_LIMITS.starter.seoModule),
      team: yesNo(PLAN_LIMITS.team.seoModule),
      business: yesNo(PLAN_LIMITS.business.seoModule),
      enterprise: yesNo(PLAN_LIMITS.enterprise.seoModule)
    },
    {
      feature: 'Custom content policies',
      starter: yesNo(PLAN_LIMITS.starter.policies),
      team: yesNo(PLAN_LIMITS.team.policies),
      business: yesNo(PLAN_LIMITS.business.policies),
      enterprise: yesNo(PLAN_LIMITS.enterprise.policies)
    },
    {
      feature: 'Site inventory',
      starter: yesNo(PLAN_LIMITS.starter.inventory),
      team: yesNo(PLAN_LIMITS.team.inventory),
      business: yesNo(PLAN_LIMITS.business.inventory),
      enterprise: yesNo(PLAN_LIMITS.enterprise.inventory)
    },
    {
      feature: 'PDF accessibility',
      starter: yesNo(PLAN_LIMITS.starter.pdfAccessibility),
      team: yesNo(PLAN_LIMITS.team.pdfAccessibility),
      business: yesNo(PLAN_LIMITS.business.pdfAccessibility),
      enterprise: yesNo(PLAN_LIMITS.enterprise.pdfAccessibility)
    },
    {
      feature: 'Self-hosted deployment',
      starter: '—',
      team: '—',
      business: '—',
      enterprise: 'Available'
    },
    {
      feature: 'SSO / SAML',
      starter: '—',
      team: '—',
      business: '—',
      enterprise: 'On request'
    },
    {
      feature: 'Invoice / PO billing',
      starter: '—',
      team: '—',
      business: 'On request',
      enterprise: 'Included'
    }
  ]
}

export const PRICING_COMPARISON_COLUMNS: ReadonlyArray<{
  key: PricingComparisonColumn
  label: string
}> = [
  { key: 'starter', label: 'Starter' },
  { key: 'team', label: 'Team' },
  { key: 'business', label: 'Business' },
  { key: 'enterprise', label: 'Enterprise' }
]
