import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DASHBOARD_SECTION_ORDER,
  normalizeDashboardSectionOrder,
  readDashboardSectionOrderForOrg,
  writeDashboardSectionOrderForOrg
} from '~/utils/dashboardSectionOrder'

describe('dashboardSectionOrder', () => {
  it('returns default order for invalid stored values', () => {
    expect(normalizeDashboardSectionOrder(null)).toEqual(DEFAULT_DASHBOARD_SECTION_ORDER)
    expect(normalizeDashboardSectionOrder('accessibility')).toEqual(DEFAULT_DASHBOARD_SECTION_ORDER)
    expect(normalizeDashboardSectionOrder([])).toEqual(DEFAULT_DASHBOARD_SECTION_ORDER)
  })

  it('dedupes and appends missing section ids', () => {
    expect(normalizeDashboardSectionOrder(['seo', 'qa', 'seo', 'qa'])).toEqual([
      'seo',
      'qa',
      'accessibility'
    ])
  })

  it('preserves valid custom order', () => {
    expect(normalizeDashboardSectionOrder(['qa', 'seo', 'accessibility'])).toEqual([
      'qa',
      'seo',
      'accessibility'
    ])
  })

  it('reads and writes per-org order maps', () => {
    const stored = writeDashboardSectionOrderForOrg({}, 'org-1', ['seo', 'qa'])
    expect(readDashboardSectionOrderForOrg(stored, 'org-1')).toEqual([
      'seo',
      'qa',
      'accessibility'
    ])
    expect(readDashboardSectionOrderForOrg(stored, 'org-2')).toEqual(DEFAULT_DASHBOARD_SECTION_ORDER)
  })
})
