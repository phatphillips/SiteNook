import { describe, expect, it } from 'vitest'
import {
  buildInventoryRefsForPage,
  countInventoryRefsByAssetUrl,
  dedupeInventoryRefIds
} from '../../../src/qa/inventoryRefs.js'

describe('buildInventoryRefsForPage', () => {
  it('creates one ref per normalized asset URL on a page', () => {
    const refs = buildInventoryRefsForPage('scan1', 'page1', [
      { url: 'https://cdn.example.com/logo.png?v=1' },
      { url: 'https://cdn.example.com/logo.png?v=2' },
      { url: 'https://cdn.example.com/style.css' }
    ])

    expect(refs).toEqual([
      { scan: 'scan1', page: 'page1', asset_url: 'https://cdn.example.com/logo.png' },
      { scan: 'scan1', page: 'page1', asset_url: 'https://cdn.example.com/style.css' }
    ])
  })
})

describe('dedupeInventoryRefIds', () => {
  it('returns duplicate ids for same asset URL and page', () => {
    const deleteIds = dedupeInventoryRefIds([
      { id: 'a', asset_url: 'https://cdn.example.com/a.png', page: 'p1' },
      { id: 'b', asset_url: 'https://cdn.example.com/a.png?x=1', page: 'p1' },
      { id: 'c', asset_url: 'https://cdn.example.com/a.png', page: 'p2' }
    ])

    expect(deleteIds).toEqual(['b'])
  })
})

describe('countInventoryRefsByAssetUrl', () => {
  it('counts unique pages per normalized asset URL', () => {
    const counts = countInventoryRefsByAssetUrl([
      { asset_url: 'https://cdn.example.com/logo.png', page: 'p1' },
      { asset_url: 'https://cdn.example.com/logo.png?v=2', page: 'p2' },
      { asset_url: 'https://cdn.example.com/logo.png', page: 'p2' }
    ])

    expect(counts.get('https://cdn.example.com/logo.png')).toBe(2)
  })
})
