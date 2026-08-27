import { pbAnd, pbOr, pbSelect } from '~/utils/pbFilter'

export type InventoryAssetTab = 'files' | 'images' | 'pdfs'

const IMAGE_URL_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico'] as const

function urlSuffixClauses(suffix: string): string {
  const escaped = suffix.replace(/'/g, '\\\'')
  return `url ~ '${escaped}'`
}

/**
 * PocketBase filter for inventory asset tabs.
 * Prefers asset_category (set at scan consolidate time); legacy URL heuristics cover older rows.
 */
export function buildInventoryAssetTabFilter(tab: InventoryAssetTab): string | null {
  if (tab === 'images') {
    return pbOr([
      pbSelect('asset_category', 'image'),
      ...IMAGE_URL_SUFFIXES.map(urlSuffixClauses),
      `mime_type ~ 'image/'`
    ])
  }

  if (tab === 'pdfs') {
    return pbOr([
      pbSelect('asset_category', 'pdf'),
      'is_pdf = true',
      urlSuffixClauses('.pdf')
    ])
  }

  if (tab === 'files') {
    const excludeImages = IMAGE_URL_SUFFIXES.map(suffix => `url !~ '${suffix.replace(/'/g, '\\\'')}'`)
    return pbOr([
      pbSelect('asset_category', 'file'),
      pbAnd([
        'is_pdf = false',
        `mime_type !~ 'image/'`,
        ...excludeImages
      ])
    ])
  }

  return null
}
