import { describe, expect, it } from 'vitest'
import { buildInventoryAssetTabFilter } from '../../../server/utils/inventoryAssetFilters'

describe('buildInventoryAssetTabFilter', () => {
  it('builds image filter with asset_category', () => {
    const filter = buildInventoryAssetTabFilter('images')
    expect(filter).toContain("asset_category = 'image'")
    expect(filter).toContain("url ~ '.jpg'")
  })

  it('builds pdf filter with asset_category', () => {
    const filter = buildInventoryAssetTabFilter('pdfs')
    expect(filter).toContain("asset_category = 'pdf'")
    expect(filter).toContain('is_pdf = true')
  })

  it('builds files filter with asset_category and legacy exclusions', () => {
    const filter = buildInventoryAssetTabFilter('files')
    expect(filter).toContain("asset_category = 'file'")
    expect(filter).toContain('is_pdf = false')
    expect(filter).toContain("url !~ '.png'")
  })
})
