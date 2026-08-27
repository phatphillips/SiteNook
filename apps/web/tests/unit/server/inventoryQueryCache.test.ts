import { describe, expect, it, beforeEach } from 'vitest'
import {
  clearInventoryListCache,
  getCachedInventoryList,
  inventoryListCacheKey,
  setCachedInventoryList
} from '../../../server/utils/inventoryQueryCache'

describe('inventoryQueryCache', () => {
  beforeEach(() => {
    clearInventoryListCache()
  })

  it('stores and retrieves cached inventory rows', () => {
    const key = inventoryListCacheKey('org-1', { tab: 'pages' })
    setCachedInventoryList(key, [{ url: 'https://example.com/a' }])
    expect(getCachedInventoryList(key)).toEqual([{ url: 'https://example.com/a' }])
  })

  it('includes site and search in cache key', () => {
    const a = inventoryListCacheKey('org-1', { tab: 'images', siteId: 'site-a', search: 'logo' })
    const b = inventoryListCacheKey('org-1', { tab: 'images', siteId: 'site-b', search: 'logo' })
    expect(a).not.toBe(b)
  })
})
