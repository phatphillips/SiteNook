import { describe, expect, it } from 'vitest'
import {
  buildPlanUsageBreakdown,
  formatUsagePercent,
  summarizeUsageLimits,
  USAGE_WARNING_THRESHOLD
} from '~/utils/planUsageBreakdown'

const baseUsage = {
  siteCount: 2,
  teamMemberCount: 2,
  scheduledSiteCount: 0,
  policyCount: 0,
  seoEnabledSiteCount: 0
}

describe('planUsageBreakdown', () => {
  it('marks numeric usage as warning near threshold', () => {
    const limits = Math.floor(10 * USAGE_WARNING_THRESHOLD)
    const rows = buildPlanUsageBreakdown('team', {
      ...baseUsage,
      siteCount: limits
    })
    const sites = rows.find(row => row.id === 'sites')
    expect(sites?.status).toBe('warning')
  })

  it('marks exceeded site usage', () => {
    const summary = summarizeUsageLimits(buildPlanUsageBreakdown('starter', {
      ...baseUsage,
      siteCount: 5
    }))
    expect(summary.status).toBe('exceeded')
    expect(summary.messages.some(message => message.includes('Sites'))).toBe(true)
  })

  it('marks unavailable features in use as exceeded', () => {
    const summary = summarizeUsageLimits(buildPlanUsageBreakdown('starter', {
      ...baseUsage,
      scheduledSiteCount: 2
    }))
    expect(summary.status).toBe('exceeded')
    expect(summary.messages.some(message => message.includes('Scheduled scans'))).toBe(true)
  })

  it('formats usage percent', () => {
    expect(formatUsagePercent(0.496)).toBe('49.6%')
    expect(formatUsagePercent(null)).toBe('—')
  })
})
