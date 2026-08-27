/** Strip query/hash and trailing slash for inventory storage and dedupe. */
export function normalizeInventoryUrl(url: string): string {
  try {
    const u = new URL(url)
    u.search = ''
    u.hash = ''
    let path = u.pathname
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    u.pathname = path
    return u.toString()
  } catch {
    const trimmed = url.trim()
    const noHash = trimmed.split('#')[0] ?? trimmed
    return noHash.split('?')[0] ?? noHash
  }
}

const IMAGE_PATH = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)$/i

export function isInventoryImageUrl(url: string): boolean {
  try {
    return IMAGE_PATH.test(new URL(url).pathname)
  } catch {
    return IMAGE_PATH.test(url.split('?')[0]?.split('#')[0] ?? url)
  }
}

export function isInventoryPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return url.toLowerCase().split('?')[0]?.endsWith('.pdf') ?? false
  }
}

export function guessInventoryMimeType(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (path.endsWith('.pdf')) return 'application/pdf'
    if (/\.jpe?g$/.test(path)) return 'image/jpeg'
    if (path.endsWith('.png')) return 'image/png'
    if (path.endsWith('.gif')) return 'image/gif'
    if (path.endsWith('.webp')) return 'image/webp'
    if (path.endsWith('.svg')) return 'image/svg+xml'
    if (path.endsWith('.avif')) return 'image/avif'
    if (path.endsWith('.bmp')) return 'image/bmp'
    if (path.endsWith('.ico')) return 'image/x-icon'
  } catch {
    // fall through
  }
  return 'unknown'
}

export function inventoryAssetFromUrl(rawUrl: string, pageUrl: string): {
  url: string
  content_type: string
  mime_type: string
  is_pdf: boolean
  size_bytes: number
} | null {
  try {
    const resolved = normalizeInventoryUrl(new URL(rawUrl, pageUrl).toString())
    const isPdf = resolved.toLowerCase().endsWith('.pdf')
    const mime = guessInventoryMimeType(resolved)
    return {
      url: resolved,
      content_type: isPdf ? 'pdf' : 'asset',
      mime_type: mime,
      is_pdf: isPdf,
      asset_category: isPdf ? 'pdf' : (mime.startsWith('image/') || isInventoryImageUrl(resolved) ? 'image' : 'file'),
      size_bytes: 0
    }
  } catch {
    return null
  }
}
