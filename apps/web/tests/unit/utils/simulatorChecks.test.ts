import { describe, expect, it } from 'vitest'
import {
  getSimulatorCheck,
  getVisionChecks,
  visionCssFilter,
  visionOverlayClass
} from '~/utils/simulatorChecks'
import {
  buildSimulatorPageRows,
  highestImpact,
  impactRank
} from '~/utils/simulatorPages'
import type { AccessibilityIssue } from '~/types/sitenook'

describe('simulatorChecks', () => {
  it('exposes vision checks without independent tab-order', () => {
    const vision = getVisionChecks()
    expect(vision.every(c => !c.independent)).toBe(true)
    expect(vision.map(c => c.id)).toContain('protanopia')
    expect(vision.map(c => c.id)).not.toContain('tab_order')
  })

  it('returns css filters and tunnel overlay', () => {
    expect(visionCssFilter('none')).toBe('')
    expect(visionCssFilter('achromatopsia')).toContain('grayscale')
    expect(visionOverlayClass('tunnel_vision')).toBe('simulator-overlay--tunnel')
    expect(getSimulatorCheck('tab_order').independent).toBe(true)
  })
})

describe('simulatorPages', () => {
  const base = {
    scan: 'scan-1',
    rule_id: 'color-contrast',
    wcag_level: 'AA' as const,
    type: 'error' as const,
    description: 'Contrast issue',
    status: 'open' as const
  }

  it('ranks impacts and picks highest', () => {
    expect(impactRank('critical')).toBeGreaterThan(impactRank('minor'))
    expect(highestImpact([
      { ...base, id: '1', page: 'p1', impact: 'minor' },
      { ...base, id: '2', page: 'p1', impact: 'serious', rule_id: 'link-name' }
    ] as AccessibilityIssue[])).toBe('serious')
  })

  it('groups open issues by page id with severity and count', () => {
    const issues = [
      {
        ...base,
        id: '1',
        page: 'page-a',
        impact: 'moderate' as const,
        expand: { page: { url: 'https://ex.com/a', title: 'A' } }
      },
      {
        ...base,
        id: '2',
        page: 'page-a',
        impact: 'critical' as const,
        rule_id: 'image-alt',
        expand: { page: { url: 'https://ex.com/a', title: 'A' } }
      },
      {
        ...base,
        id: '3',
        page: 'page-b',
        impact: 'minor' as const,
        rule_id: 'label',
        expand: { page: { url: 'https://ex.com/b', title: 'B' } }
      },
      {
        ...base,
        id: '4',
        page: 'page-b',
        impact: 'minor' as const,
        rule_id: 'label',
        status: 'dismissed' as const,
        expand: { page: { url: 'https://ex.com/b', title: 'B' } }
      }
    ] as AccessibilityIssue[]

    const rows = buildSimulatorPageRows(issues, { siteId: 'site-1' })
    expect(rows).toHaveLength(2)
    expect(rows[0].pageId).toBe('page-a')
    expect(rows[0].issueCount).toBe(2)
    expect(rows[0].highestImpact).toBe('critical')
    expect(rows[0].highestSeverityLabel).toBe('Critical')
    expect(rows[0].siteId).toBe('site-1')
    expect(rows[1].pageId).toBe('page-b')
    expect(rows[1].issueCount).toBe(1)
  })
})
