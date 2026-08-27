import { describe, expect, it } from 'vitest'
import { mergeA11yCheckStats, parseA11yCheckStats } from '~/utils/a11yCheckStats'
import { FALLBACK_AXE_CATALOG } from '~/utils/axeCheckCatalog'

describe('a11yCheckStats (web)', () => {
  it('exposes a full fallback catalog', () => {
    expect(FALLBACK_AXE_CATALOG.length).toBeGreaterThan(80)
    expect(FALLBACK_AXE_CATALOG.some(entry => entry.rule_id === 'color-contrast')).toBe(true)
  })

  it('merges rule counts across pages', () => {
    const merged = mergeA11yCheckStats([
      {
        catalog: [{ rule_id: 'color-contrast', wcag_level: 'AA', is_best_practice: false }],
        rules: { 'color-contrast': { failed: 3, passed: 10, incomplete: 0 } }
      },
      {
        catalog: [{ rule_id: 'color-contrast', wcag_level: 'AA', is_best_practice: false }],
        rules: { 'color-contrast': { failed: 1, passed: 4, incomplete: 0 } }
      }
    ])
    expect(merged.rules['color-contrast']).toEqual({ failed: 4, passed: 14, incomplete: 0 })
  })

  it('parses stored scan stats', () => {
    expect(parseA11yCheckStats({ catalog: [], rules: {} })).toBeUndefined()
    expect(parseA11yCheckStats({
      catalog: [{ rule_id: 'empty-heading', wcag_level: 'AA', is_best_practice: true }],
      rules: { 'empty-heading': { failed: 4, passed: 12, incomplete: 0 } }
    })?.rules['empty-heading']?.failed).toBe(4)
  })
})
