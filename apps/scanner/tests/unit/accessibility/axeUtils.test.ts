import { describe, it, expect } from 'vitest'
import { DEFAULT_AXE_TAGS, applyAxeExcludeSelectors, checkStatsFromAxeResults } from '../../../src/accessibility/axeRunner.js'

describe('DEFAULT_AXE_TAGS', () => {
  it('includes WCAG 2.2 and best-practice tags for full inventory scans', () => {
    expect(DEFAULT_AXE_TAGS).toContain('wcag22a')
    expect(DEFAULT_AXE_TAGS).toContain('wcag22aa')
    expect(DEFAULT_AXE_TAGS).toContain('wcag22aaa')
    expect(DEFAULT_AXE_TAGS).toContain('best-practice')
  })
})

describe('applyAxeExcludeSelectors', () => {
  it('calls exclude for each non-empty selector', () => {
    const excluded: string[] = []
    const builder = {
      exclude(selector: string) {
        excluded.push(selector)
        return this
      }
    }

    applyAxeExcludeSelectors(builder, [
      'iframe[src*="youtube.com"]',
      '  ',
      'iframe'
    ])

    expect(excluded).toEqual([
      'iframe[src*="youtube.com"]',
      'iframe'
    ])
  })

  it('skips invalid selectors instead of applying them', () => {
    const excluded: string[] = []
    const builder = {
      exclude(selector: string) {
        excluded.push(selector)
        return this
      }
    }

    applyAxeExcludeSelectors(builder, ['<iframe\\b', 'iframe'])
    expect(excluded).toEqual(['iframe'])
  })

  it('no-ops when selectors are missing', () => {
    const builder = { exclude: () => builder }
    expect(applyAxeExcludeSelectors(builder, undefined)).toBe(builder)
    expect(applyAxeExcludeSelectors(builder, [])).toBe(builder)
  })
})

describe('checkStatsFromAxeResults', () => {
  it('counts failed, passed, incomplete, and inapplicable catalog rules', () => {
    const stats = checkStatsFromAxeResults({
      violations: [{ id: 'color-contrast', tags: ['wcag2aa', 'wcag143'], nodes: [{}, {}] }],
      passes: [{ id: 'image-alt', tags: ['wcag2a', 'wcag111'], nodes: [{}, {}, {}] }],
      incomplete: [{ id: 'link-name', tags: ['wcag2a'], nodes: [{}] }],
      inapplicable: [{ id: 'video-caption', tags: ['wcag2a'], nodes: [] }]
    })
    expect(stats.rules['color-contrast']?.failed).toBe(2)
    expect(stats.rules['image-alt']?.passed).toBe(3)
    expect(stats.rules['link-name']?.incomplete).toBe(1)
    expect(stats.catalog.map(entry => entry.rule_id)).toEqual([
      'color-contrast',
      'image-alt',
      'link-name',
      'video-caption'
    ])
  })
})
