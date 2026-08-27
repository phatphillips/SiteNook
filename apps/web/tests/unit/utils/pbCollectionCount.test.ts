import { describe, it, expect, vi } from 'vitest'
import { FullListGuardError, countCollection, FULL_LIST_MAX_ITEMS, safeGetFullList } from '~/utils/pbCollectionCount'

describe('pbCollectionCount', () => {
  it('countCollection returns totalItems from getList', async () => {
    const pb = {
      collection: () => ({
        getList: vi.fn().mockResolvedValue({ totalItems: 42, items: [{}] })
      })
    }
    const total = await countCollection(pb as never, 'qa_inventory', 'scan = "x"')
    expect(total).toBe(42)
  })

  it('safeGetFullList throws when collection exceeds guard limit', async () => {
    const pb = {
      collection: () => ({
        getList: vi.fn().mockResolvedValue({ totalItems: FULL_LIST_MAX_ITEMS + 1, items: [] }),
        getFullList: vi.fn()
      })
    }
    await expect(
      safeGetFullList(pb as never, 'qa_inventory', { filter: 'scan = "x"' })
    ).rejects.toBeInstanceOf(FullListGuardError)
  })
})
