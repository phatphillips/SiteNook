import type { OrganizationPlan } from '~/types/accessiq'
import {
  formatPlanPrimaryMetric,
  isOrganizationPlan,
  isPaidCheckoutPlan,
  ORGANIZATION_PLANS,
  type PaidCheckoutPlan
} from '~/utils/planLimits'
import { buildDevBypassStartUrl } from '~/utils/stripeCheckout'

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
  body: 'Start free with 1 site, 100 pages/scan, and manual scans.',
  ctaLabel: 'Get started free'
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
    description: 'Small teams running scheduled monitoring in production.',
    monthlyPrice: 99,
    annualMonthlyPrice: 84,
    primaryMetric: formatPlanPrimaryMetric('team'),
    deploymentLabel: HOSTED_DEPLOYMENT_LABEL,
    inheritsFrom: 'Starter',
    highlighted: true,
    features: [
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

const FREE_PLAN_OFFERING: PlanOffering = {
  id: 'free',
  name: 'Free',
  description: 'Try AccessIQ on a single site with essential monitoring.',
  monthlyPrice: 0,
  annualMonthlyPrice: 0,
  primaryMetric: formatPlanPrimaryMetric('free'),
  deploymentLabel: HOSTED_DEPLOYMENT_LABEL,
  features: [
    '1 site',
    'Up to 100 pages per scan',
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

export interface PlanCtaOptions {
  selfServiceEnabled: boolean
  supportEmail: string
  stripeCheckoutConfigured?: boolean
  devBypassEnabled?: boolean
  billingInterval?: BillingInterval
  annualCheckoutConfigured?: boolean
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
      href: `mailto:${email}?subject=${encodeURIComponent('AccessIQ Enterprise plan')}`,
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

export function formatPlanLabel(plan: OrganizationPlan | null | undefined): string {
  if (!plan) return ''
  return getPlanOffering(plan)?.name ?? plan
}
