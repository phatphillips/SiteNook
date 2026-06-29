import { describe, expect, it } from 'vitest'
import { chunkPageIds, pbOrPageIds } from '~/utils/a11yQueryFields'

describe('a11yQueryFields', () => {
  it('pbOrPageIds joins page filters with OR', () => {
    expect(pbOrPageIds(['a', 'b'])).toBe('page = "a" || page = "b"')
  })

  it('chunkPageIds splits into batches', () => {
    const ids = Array.from({ length: 5 }, (_, i) => `id${i}`)
    const batches = chunkPageIds(ids, 2)
    expect(batches).toHaveLength(3)
    expect(batches[0]).toEqual(['id0', 'id1'])
    expect(batches[2]).toEqual(['id4'])
  })
})

describe('buildPointsToGainByRule', () => {
  it('precomputes points for each rule', async () => {
    const { buildPointsToGainByRule } = await import('~/composables/useAccessibility')
    const map = buildPointsToGainByRule([
      {
        id: '1',
        scan: 's1',
        page: 'p1',
        rule_id: 'color-contrast',
        wcag_level: 'AA',
        impact: 'serious',
        type: 'error',
        description: 'Contrast',
        status: 'open'
      }
    ] as never)
    expect(map.has('color-contrast')).toBe(true)
  })
})
