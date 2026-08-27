import { describe, expect, it } from 'vitest'
import { mergeA11yCheckStats, parseA11yCheckStats } from '../../../src/accessibility/a11yCheckStats.js'

describe('a11yCheckStats', () => {
  it('merges catalog entries and sums rule counts', () => {
    const merged = mergeA11yCheckStats([
      {
        catalog: [{ rule_id: 'color-contrast', wcag_level: 'AA', is_best_practice: false }],
        rules: { 'color-contrast': { failed: 10, passed: 20, incomplete: 1 } }
      },
      {
        catalog: [
          { rule_id: 'color-contrast', wcag_level: 'AA', is_best_practice: false },
          { rule_id: 'image-alt', wcag_level: 'A', is_best_practice: false }
        ],
        rules: {
          'color-contrast': { failed: 2, passed: 5, incomplete: 0 },
          'image-alt': { failed: 0, passed: 8, incomplete: 0 }
        }
      }
    ])
    expect(merged.catalog).toHaveLength(2)
    expect(merged.rules['color-contrast']).toEqual({ failed: 12, passed: 25, incomplete: 1 })
    expect(merged.rules['image-alt']).toEqual({ failed: 0, passed: 8, incomplete: 0 })
  })

  it('parses persisted json and ignores empty payloads', () => {
    expect(parseA11yCheckStats(null)).toBeUndefined()
    expect(parseA11yCheckStats({})).toBeUndefined()
    const parsed = parseA11yCheckStats({
      catalog: [{ rule_id: 'label', wcag_level: 'A', is_best_practice: false }],
      rules: { label: { failed: 1, passed: 4, incomplete: 0 } }
    })
    expect(parsed?.catalog[0]?.rule_id).toBe('label')
    expect(parsed?.rules.label?.passed).toBe(4)
  })
})
