import type { OrganizationPlan } from '~/types/sitenook'
import type { OrganizationPlanUsage } from '~/utils/planEligibility'
import { getPlanLimits, normalizeOrganizationPlan } from '~/utils/planLimits'

export type UsageLimitStatus = 'ok' | 'warning' | 'exceeded' | 'unlimited'

export interface UsageBreakdownRow {
  id: string
  label: string
  used: number
  limit: number | null
  limitLabel: string
  usagePercent: number | null
  status: UsageLimitStatus
  description?: string
  settingsPath?: string
}

export interface UsageLimitSummary {
  status: 'ok' | 'warning' | 'exceeded'
  hasWarning: boolean
  hasExceeded: boolean
  rows: UsageBreakdownRow[]
  messages: string[]
}

/** Fraction of plan capacity that triggers a nearing-limit warning. */
export const USAGE_WARNING_THRESHOLD = 0.8

const UNLIMITED_SITES = 999_999
const UNLIMITED_MEMBERS = 999_999

function isUnlimitedCount(value: number): boolean {
  return value >= UNLIMITED_SITES || value >= UNLIMITED_MEMBERS
}

function numericRow(
  id: string,
  label: string,
  used: number,
  limit: number,
  settingsPath?: string
): UsageBreakdownRow {
  if (isUnlimitedCount(limit)) {
    return {
      id,
      label,
      used,
      limit: null,
      limitLabel: 'Unlimited',
      usagePercent: null,
      status: 'unlimited',
      settingsPath
    }
  }

  const usagePercent = limit > 0 ? Math.min(used / limit, 1) : (used > 0 ? 1 : 0)
  let status: UsageLimitStatus = 'ok'
  if (used >= limit) status = 'exceeded'
  else if (usagePercent >= USAGE_WARNING_THRESHOLD) status = 'warning'

  return {
    id,
    label,
    used,
    limit,
    limitLabel: String(limit),
    usagePercent,
    status,
    settingsPath
  }
}

function featureRow(
  id: string,
  label: string,
  used: number,
  included: boolean,
  settingsPath?: string
): UsageBreakdownRow {
  if (included) {
    return {
      id,
      label,
      used,
      limit: null,
      limitLabel: 'Included',
      usagePercent: used > 0 ? 1 : 0,
      status: used > 0 ? 'ok' : 'ok',
      settingsPath
    }
  }

  return {
    id,
    label,
    used,
    limit: 0,
    limitLabel: 'Not included',
    usagePercent: used > 0 ? 1 : 0,
    status: used > 0 ? 'exceeded' : 'ok',
    description: used > 0 ? 'Not included on your current plan' : undefined,
    settingsPath
  }
}

export function buildPlanUsageBreakdown(
  plan: OrganizationPlan | unknown,
  usage: OrganizationPlanUsage
): UsageBreakdownRow[] {
  const normalized = normalizeOrganizationPlan(plan)
  const limits = getPlanLimits(normalized)

  return [
    numericRow('sites', 'Sites', usage.siteCount, limits.maxSites, '/sites'),
    numericRow('teamMembers', 'Team members', usage.teamMemberCount, limits.maxTeamMembers, '/settings/users'),
    featureRow(
      'scheduledScans',
      'Scheduled scans',
      usage.scheduledSiteCount,
      limits.scheduledScans,
      '/sites'
    ),
    featureRow(
      'seoModule',
      'SEO monitoring',
      usage.seoEnabledSiteCount,
      limits.seoModule,
      '/sites'
    ),
    featureRow(
      'policies',
      'Content policies',
      usage.policyCount,
      limits.policies,
      '/policies'
    )
  ]
}

export function summarizeUsageLimits(rows: UsageBreakdownRow[]): UsageLimitSummary {
  const hasExceeded = rows.some(row => row.status === 'exceeded')
  const hasWarning = rows.some(row => row.status === 'warning')
  const status: UsageLimitSummary['status'] = hasExceeded
    ? 'exceeded'
    : hasWarning
      ? 'warning'
      : 'ok'

  const messages: string[] = []
  for (const row of rows) {
    if (row.status === 'exceeded') {
      if (row.limit === 0) {
        messages.push(`${row.label} is not included on your plan but is in use (${row.used}).`)
      } else if (row.limit != null) {
        messages.push(`${row.label}: ${row.used} of ${row.limit} — limit reached.`)
      }
    } else if (row.status === 'warning' && row.limit != null) {
      messages.push(`${row.label}: ${row.used} of ${row.limit} — nearing limit.`)
    }
  }

  return { status, hasWarning, hasExceeded, rows, messages }
}

export function formatUsagePercent(percent: number | null): string {
  if (percent == null) return '—'
  return `${(percent * 100).toFixed(1)}%`
}
