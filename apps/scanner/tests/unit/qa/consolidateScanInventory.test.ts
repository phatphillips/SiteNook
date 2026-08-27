import { describe, expect, it } from 'vitest'
import { dedupeInventoryRecords, inventoryAssetCategory } from '../../../src/qa/inventoryAssetCategory.js'

describe('inventoryAssetCategory', () => {
  it('classifies images, files, and pdfs', () => {
    expect(inventoryAssetCategory({ url: 'https://example.com/a.png', is_pdf: false })).toBe('image')
    expect(inventoryAssetCategory({ url: 'https://example.com/app.js', is_pdf: false })).toBe('file')
    expect(inventoryAssetCategory({ url: 'https://example.com/doc.pdf', is_pdf: true })).toBe('pdf')
  })
})

describe('dedupeInventoryRecords', () => {
  it('merges duplicate URLs and keeps the largest size', () => {
    const rows = dedupeInventoryRecords([
      { url: 'https://example.com/logo.png?v=1', size_bytes: 100, is_pdf: false },
      { url: 'https://example.com/logo.png?v=2', size_bytes: 900, is_pdf: false }
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.url).toBe('https://example.com/logo.png')
    expect(rows[0]?.size_bytes).toBe(900)
    expect(rows[0]?.asset_category).toBe('image')
  })
})
