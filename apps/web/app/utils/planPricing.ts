import type { OrganizationPlan } from '~/types/sitenook'
import {
  formatPlanPrimaryMetric,
  isOrganizationPlan,
  isPaidCheckoutPlan,
  ORGANIZATION_PLANS,
  type PaidCheckoutPlan
} from './planLimits'
import { buildDevBypassStartUrl } from './stripeCheckout'

export { isOrganizationPlan, ORGANIZATION_PLANS }

export type BillingInterval = 'monthly' | 'annual'

export interface PlanOffering {
  id: OrganizationPlan
  name: string
  description: string
  monthlyPrice: number | null
  annualMonthlyPrice: number | null
  primaryMetric: string
  deploymentLabel: string
  features: string[]
  inheritsFrom?: string
  highlighted?: boolean
  contactSales?: boolean
}

export const HOSTED_DEPLOYMENT_LABEL = 'Hosted cloud'
export const SELF_HOSTED_DEPLOYMENT_LABEL = 'Self-hosted (Enterprise)'

export const FREE_PLAN_FOOTNOTE = {
  headline: 'Not ready to subscribe?',
  body: 'Start free with 1 site, 20 pages/scan, and manual scans.',
  ctaLabel: 'Get started free'
}

export const TEAM_TRIAL_DAYS = 30

export const TEAM_TRIAL_CTA = {
  label: 'Start free trial',
  subcopy: 'Full Team features for 30 days. No credit card. Falls back to Free if you do not upgrade.'
}

export const PAID_PLAN_OFFERINGS: PlanOffering[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Solo owners validating WCAG on a few properties.',
    monthlyPrice: 39,
    annualMonthlyPrice: 33,
    primaryMetric: formatPlanPrimaryMetric('starter'),
    deploymentLabel: HOSTED_DEPLOYMENT_LABEL,
    features: [
      'WCAG accessibility scans (axe-core)',
      'QA checks: broken links + spelling',
      'Manual scans',
      '2 team members (admin + viewer)',
      '7-day scan history (summary scores)'
    ]
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Small teams running scheduled monitoring in production. Includes a 30-day free trial.',
    monthlyPrice: 99,
    annualMonthlyPrice: 84,
    primaryMetric: formatPlanPrimaryMetric('team'),
    deploymentLabel: HOSTED_DEPLOYMENT_LABEL,
    inheritsFrom: 'Starter',
    highlighted: true,
    features: [
      '30-day Team trial (no card required)',
      'Daily scheduled scans',
      'SEO module (technical, content, SERP preview)',
      'Readability scoring',
      'Up to 10 team members',
      '30-day scan history',
      'Email support'
    ]
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Multi-site orgs needing SEO, policies, and longer history.',
    monthlyPrice: 249,
    annualMonthlyPrice: 212,
    primaryMetric: formatPlanPrimaryMetric('business'),
    deploymentLabel: HOSTED_DEPLOYMENT_LABEL,
    inheritsFrom: 'Team',
    features: [
      'Custom content policies',
      'Site inventory + link graph',
      '90-day scan history',
      'Priority email support',
      'Higher concurrent scan throughput'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Compliance-heavy orgs with SLAs and custom onboarding.',
    monthlyPrice: null,
    annualMonthlyPrice: null,
    primaryMetric: formatPlanPrimaryMetric('enterprise'),
    deploymentLabel: SELF_HOSTED_DEPLOYMENT_LABEL,
    inheritsFrom: 'Business',
    contactSales: true,
    features: [
      'Unlimited / custom site & page limits',
      'Self-hosted Docker deployment',
      'SSO / SAML (available on request)',
      'Dedicated onboarding',
      'Invoice billing + SLA',
      'Extended data retention'
    ]
  }
]

/** Self-serve cards shown on the public pricing page (Hemingway-style 3-tier grid). */
export const MARKETING_PLAN_CARDS: PlanOffering[] = PAID_PLAN_OFFERINGS.filter(
  plan => plan.id === 'starter' || plan.id === 'team' || plan.id === 'business'
)

/** Typical annual discount vs monthly — used on the billing toggle badge. */
export function getTypicalAnnualSavingsPercent(): number {
  const team = PAID_PLAN_OFFERINGS.find(plan => plan.id === 'team')
  if (!team?.monthlyPrice || !team.annualMonthlyPrice) return 15
  return Math.round((1 - team.annualMonthlyPrice / team.monthlyPrice) * 100)
}

export function getPlanAnnualSavingsPercent(
  offering: Pick<PlanOffering, 'monthlyPrice' | 'annualMonthlyPrice'>
): number | null {
  if (!offering.monthlyPrice || !offering.annualMonthlyPrice) return null
  if (offering.annualMonthlyPrice >= offering.monthlyPrice) return null
  return Math.round((1 - offering.annualMonthlyPrice / offering.monthlyPrice) * 100)
}

const FREE_PLAN_OFFERING: PlanOffering = {
  id: 'free',
  name: 'Free',
  description: 'Try SiteNook on a single site with essential monitoring.',
  monthlyPrice: 0,
  annualMonthlyPrice: 0,
  primaryMetric: formatPlanPrimaryMetric('free'),
  deploymentLabel: HOSTED_DEPLOYMENT_LABEL,
    features: [
      '1 site',
      'Up to 20 pages per scan',
      'Accessibility + QA checks',
      'Manual scans only',
      'Admin and viewer roles'
    ]
  }

/** All plans including free — used for billing labels and lookups. */
export const PLAN_OFFERINGS: PlanOffering[] = [
  FREE_PLAN_OFFERING,
  ...PAID_PLAN_OFFERINGS
]

export function getPlanOffering(plan: OrganizationPlan): PlanOffering | undefined {
  return PLAN_OFFERINGS.find(offering => offering.id === plan)
}

export function formatPlanPrice(
  offering: Pick<PlanOffering, 'monthlyPrice' | 'annualMonthlyPrice' | 'contactSales'>,
  interval: BillingInterval
): { priceLabel: string, priceDetail: string } {
  if (offering.contactSales) {
    return { priceLabel: 'Custom', priceDetail: 'pricing' }
  }

  const monthly = offering.monthlyPrice ?? 0
  const annualMonthly = offering.annualMonthlyPrice ?? monthly

  if (interval === 'annual') {
    return {
      priceLabel: `$${annualMonthly}`,
      priceDetail: 'per month, billed annually'
    }
  }

  return {
    priceLabel: `$${monthly}`,
    priceDetail: 'per month'
  }
}

export function buildFreePlanStartUrl(): string {
  return '/start?plan=free'
}

export function buildTeamTrialStartUrl(): string {
  return '/start?plan=team&trial=1'
}

export function parseTeamTrialFlag(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'trial'
}

export interface PlanCtaOptions {
  selfServiceEnabled: boolean
  supportEmail: string
  stripeCheckoutConfigured?: boolean
  devBypassEnabled?: boolean
  billingInterval?: BillingInterval
  annualCheckoutConfigured?: boolean
  /** Prefer no-card Team trial CTA over immediate Subscribe (default true for marketing). */
  preferTeamTrial?: boolean
}

export type PlanCtaAction
  = | { kind: 'link', href: string, label: string }
    | { kind: 'mailto', href: string, label: string }
    | { kind: 'checkout', plan: PaidCheckoutPlan, interval: BillingInterval, label: string }
    | { kind: 'pending', label: string, hint: string }

export function resolvePlanCta(
  plan: OrganizationPlan,
  options: PlanCtaOptions
): PlanCtaAction {
  if (plan === 'free') {
    if (options.selfServiceEnabled) {
      return { kind: 'link', href: buildFreePlanStartUrl(), label: FREE_PLAN_FOOTNOTE.ctaLabel }
    }
    return { kind: 'link', href: '/signup', label: 'Request access' }
  }

  if (plan === 'enterprise') {
    const email = options.supportEmail.trim() || 'contact@your-org.com'
    return {
      kind: 'mailto',
      href: `mailto:${email}?subject=${encodeURIComponent('SiteNook Enterprise plan')}`,
      label: 'Contact sales'
    }
  }

  if (!isPaidCheckoutPlan(plan)) {
    return {
      kind: 'pending',
      label: 'Subscribe',
      hint: 'This plan is not available for self-service checkout.'
    }
  }

  const preferTeamTrial = options.preferTeamTrial !== false
  if (plan === 'team' && preferTeamTrial && options.selfServiceEnabled) {
    return {
      kind: 'link',
      href: buildTeamTrialStartUrl(),
      label: TEAM_TRIAL_CTA.label
    }
  }

  const interval = options.billingInterval === 'annual' && options.annualCheckoutConfigured
    ? 'annual'
    : 'monthly'

  if (options.stripeCheckoutConfigured) {
    return {
      kind: 'checkout',
      plan,
      interval,
      label: 'Subscribe'
    }
  }

  if (options.devBypassEnabled && options.selfServiceEnabled) {
    return {
      kind: 'link',
      href: buildDevBypassStartUrl(plan),
      label: 'Subscribe (dev bypass)'
    }
  }

  return {
    kind: 'pending',
    label: 'Subscribe',
    hint: 'Add Stripe test keys (see docs/stripe-setup.md) or enable dev bypass for local testing.'
  }
}

/** Secondary paid checkout CTA for Team when the primary button is the free trial. */
export function resolveTeamSubscribeCta(options: PlanCtaOptions): PlanCtaAction | null {
  if (!options.selfServiceEnabled) return null
  return resolvePlanCta('team', { ...options, preferTeamTrial: false })
}

export function formatPlanLabel(plan: OrganizationPlan | null | undefined): string {
  if (!plan) return ''
  return getPlanOffering(plan)?.name ?? plan
}

export function computeTrialEndsAt(from: Date = new Date(), days = TEAM_TRIAL_DAYS): string {
  const end = new Date(from.getTime())
  end.setUTCDate(end.getUTCDate() + days)
  return end.toISOString()
}

export function daysRemainingUntil(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso?.trim()) return null
  const end = new Date(iso)
  if (Number.isNaN(end.getTime())) return null
  const ms = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}
