import { describe, it, expect } from 'vitest'
import { mapPool } from '../../../server/utils/mapPool'

describe('mapPool', () => {
  it('returns empty array for empty input', async () => {
    await expect(mapPool([], 4, async () => 1)).resolves.toEqual([])
  })

  it('preserves order with bounded concurrency', async () => {
    const active = { count: 0, max: 0 }
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      active.count += 1
      active.max = Math.max(active.max, active.count)
      await new Promise(resolve => setTimeout(resolve, 10))
      active.count -= 1
      return n * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50])
    expect(active.max).toBeLessThanOrEqual(2)
  })
})
