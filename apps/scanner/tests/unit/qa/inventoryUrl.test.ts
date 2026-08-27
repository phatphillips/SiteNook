import { describe, expect, it } from 'vitest'
import { inventoryAssetFromUrl, normalizeInventoryUrl } from '../../../src/qa/inventoryUrl.js'

describe('inventoryAssetFromUrl', () => {
  it('normalizes URLs and infers image mime type', () => {
    const asset = inventoryAssetFromUrl('/images/hero.jpg?cache=1', 'https://example.com/about')
    expect(asset).toMatchObject({
      url: 'https://example.com/images/hero.jpg',
      mime_type: 'image/jpeg',
      asset_category: 'image',
      content_type: 'asset',
      is_pdf: false
    })
  })

  it('detects PDF assets', () => {
    const asset = inventoryAssetFromUrl('/docs/guide.pdf', 'https://example.com')
    expect(asset).toMatchObject({
      url: 'https://example.com/docs/guide.pdf',
      mime_type: 'application/pdf',
      content_type: 'pdf',
      is_pdf: true
    })
  })
})

describe('normalizeInventoryUrl', () => {
  it('drops tracking query params', () => {
    expect(normalizeInventoryUrl('https://example.com/x?utm_source=abc'))
      .toBe('https://example.com/x')
  })
})
