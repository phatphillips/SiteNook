/**
 * Plan limits mirror apps/web/app/utils/planLimits.ts — keep values in sync.
 */

import { isCommercialEnabled } from './commercial.js'

export type OrganizationPlan = 'free' | 'starter' | 'team' | 'business' | 'enterprise'

export type PlanFeature = 'scheduledScans' | 'seoModule' | 'policies' | 'inventory' | 'pdfAccessibility'

export interface PlanLimitSet {
  maxPagesPerScan: number
  scanHistoryDays: number
  scheduledScans: boolean
  seoModule: boolean
  policies: boolean
  inventory: boolean
  pdfAccessibility: boolean
}

const LEGACY_PLAN_ALIASES: Record<string, OrganizationPlan> = {
  standard: 'team'
}

const PLAN_LIMITS: Record<OrganizationPlan, PlanLimitSet> = {
  free: {
    maxPagesPerScan: 20,
    scanHistoryDays: 7,
    scheduledScans: false,
    seoModule: false,
    policies: false,
    inventory: false,
    pdfAccessibility: false
  },
  starter: {
    maxPagesPerScan: 500,
    scanHistoryDays: 7,
    scheduledScans: false,
    seoModule: false,
    policies: false,
    inventory: false,
    pdfAccessibility: false
  },
  team: {
    maxPagesPerScan: 1_500,
    scanHistoryDays: 30,
    scheduledScans: true,
    seoModule: true,
    policies: false,
    inventory: false,
    pdfAccessibility: false
  },
  business: {
    maxPagesPerScan: 5_000,
    scanHistoryDays: 90,
    scheduledScans: true,
    seoModule: true,
    policies: true,
    inventory: true,
    pdfAccessibility: true
  },
  enterprise: {
    maxPagesPerScan: 50_000,
    scanHistoryDays: 365,
    scheduledScans: true,
    seoModule: true,
    policies: true,
    inventory: true,
    pdfAccessibility: true
  }
}

export function normalizeOrganizationPlan(plan: unknown): OrganizationPlan {
  if (typeof plan !== 'string') return 'free'
  const trimmed = plan.trim().toLowerCase()
  if (trimmed in LEGACY_PLAN_ALIASES) {
    return LEGACY_PLAN_ALIASES[trimmed]!
  }
  if (trimmed in PLAN_LIMITS) {
    return trimmed as OrganizationPlan
  }
  return 'free'
}

export function getPlanLimits(plan: unknown): PlanLimitSet {
  if (!isCommercialEnabled()) {
    return PLAN_LIMITS.enterprise
  }
  return PLAN_LIMITS[normalizeOrganizationPlan(plan)]
}

export function getMaxPagesPerScanForPlan(plan: unknown): number {
  return getPlanLimits(plan).maxPagesPerScan
}

export function planHasFeature(plan: unknown, feature: PlanFeature): boolean {
  return getPlanLimits(plan)[feature]
}
