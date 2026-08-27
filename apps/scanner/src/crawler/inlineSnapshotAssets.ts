/** Total freeze-frame size target (HTML + inlined assets). PocketBase file cap is 8MB. */
export const SNAPSHOT_INLINE_BUDGET_BYTES = 7.5 * 1024 * 1024

/** Skip a single image/font larger than this (base64 would be ~33% bigger). */
export const INLINE_ASSET_MAX_BYTES = 2.5 * 1024 * 1024

const FETCH_CONCURRENCY = 8

const TRACKING_HOST_RE = /(?:^|\.)(?:facebook\.com|facebook\.net|fbcdn\.net|google-analytics\.com|googletagmanager\.com|googleadservices\.com|doubleclick\.net|googlesyndication\.com|tiktok\.com|snapchat\.com|hotjar\.com|newrelic\.com|scorecardresearch\.com|adsystem\.com|ads-twitter\.com|twitter\.com)$/i

export interface FetchedSnapshotAsset {
  bytes: Buffer
  contentType: string
}

export type FetchSnapshotAsset = (url: string) => Promise<FetchedSnapshotAsset | null>

export function decodeHtmlAttrUrl(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export function absolutizeMaybeUrl(value: string, pageUrl?: string): string {
  const raw = decodeHtmlAttrUrl(value)
  if (!raw) return ''
  if (raw.startsWith('//')) {
    try {
      const base = pageUrl ? new URL(pageUrl) : null
      return `${base?.protocol || 'https:'}${raw}`
    } catch {
      return `https:${raw}`
    }
  }
  if (pageUrl && !/^(data:|blob:|https?:|javascript:|#)/i.test(raw)) {
    try {
      return new URL(raw, pageUrl).href
    } catch {
      return raw
    }
  }
  return raw
}

export function shouldInlineSnapshotAsset(url: string): boolean {
  const raw = decodeHtmlAttrUrl(url)
  if (!raw) return false
  if (/^(data:|blob:|#)/i.test(raw)) return false
  if (/^javascript:/i.test(raw)) return false

  let parsed: URL
  try {
    parsed = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
  } catch {
    return false
  }
  if (!/^https?:$/i.test(parsed.protocol)) return false
  if (TRACKING_HOST_RE.test(parsed.hostname)) return false
  if (/\/tr\/?\?/i.test(`${parsed.pathname}${parsed.search}`)) return false
  return true
}

function attrValue(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i'))
  if (quoted) return quoted[2]
  const unquoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, 'i'))
  return unquoted?.[1] ?? null
}

function collectAttrUrls(html: string): string[] {
  const urls: string[] = []
  const tags = html.match(/<(?:img|source|image|video)\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const isVideo = /^<video\b/i.test(tag)
    const names = isVideo ? ['poster'] : ['src', 'href']
    for (const name of names) {
      const value = attrValue(tag, name)
      if (value) urls.push(decodeHtmlAttrUrl(value))
    }
    const srcset = attrValue(tag, 'srcset')
    if (srcset && !isVideo) {
      for (const part of srcset.split(',')) {
        const url = decodeHtmlAttrUrl(part.trim().split(/\s+/)[0] || '')
        if (url) urls.push(url)
      }
    }
  }
  return urls
}

function collectCssUrls(html: string): string[] {
  const urls: string[] = []
  for (const match of html.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
    const url = decodeHtmlAttrUrl(match[2] || '')
    if (url) urls.push(url)
  }
  return urls
}

export function collectSnapshotAssetUrls(html: string, pageUrl?: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...collectAttrUrls(html), ...collectCssUrls(html)]) {
    const url = absolutizeMaybeUrl(raw, pageUrl)
    if (!url || seen.has(url) || !shouldInlineSnapshotAsset(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

export function mimeTypeForAsset(contentType: string, url: string): string | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() || ''
  if (/^text\/html/i.test(mime) || /^text\/css/i.test(mime)) return null
  if (mime && !/^application\/octet-stream$/i.test(mime)) {
    return mime
  }
  let pathname = ''
  try {
    pathname = new URL(url).pathname.toLowerCase()
  } catch {
    pathname = url.toLowerCase()
  }
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg'
  if (pathname.endsWith('.gif')) return 'image/gif'
  if (pathname.endsWith('.webp')) return 'image/webp'
  if (pathname.endsWith('.svg')) return 'image/svg+xml'
  if (pathname.endsWith('.ico')) return 'image/x-icon'
  if (pathname.endsWith('.avif')) return 'image/avif'
  if (pathname.endsWith('.woff2')) return 'font/woff2'
  if (pathname.endsWith('.woff')) return 'font/woff'
  if (pathname.endsWith('.ttf')) return 'font/ttf'
  if (pathname.endsWith('.otf')) return 'font/otf'
  if (pathname.endsWith('.eot')) return 'application/vnd.ms-fontobject'
  return mime.startsWith('image/') || mime.startsWith('font/') ? mime : null
}

export function dataUriFromAsset(bytes: Buffer, mime: string): string {
  return `data:${mime};base64,${bytes.toString('base64')}`
}

export function replaceHtmlAssetUrls(html: string, dataUris: Map<string, string>): string {
  const entries = [...dataUris.entries()].sort((a, b) => b[0].length - a[0].length)
  let out = html
  for (const [url, dataUri] of entries) {
    if (!url || !dataUri || url === dataUri) continue
    out = out.split(url).join(dataUri)
    const escaped = url.replace(/&/g, '&amp;')
    if (escaped !== url) out = out.split(escaped).join(dataUri)
  }
  return out
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      out[index] = await fn(items[index] as T)
    }
  }
  const workers = Math.min(Math.max(1, limit), Math.max(items.length, 1))
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return out
}

export async function inlineFetchedAssets(
  html: string,
  fetchAsset: FetchSnapshotAsset,
  options?: { budgetBytes?: number, maxAssetBytes?: number, pageUrl?: string }
): Promise<string> {
  if (!html) return html
  const budget = options?.budgetBytes ?? SNAPSHOT_INLINE_BUDGET_BYTES
  const maxAsset = options?.maxAssetBytes ?? INLINE_ASSET_MAX_BYTES
  const urls = collectSnapshotAssetUrls(html, options?.pageUrl)
  if (!urls.length) return html

  let remaining = budget - Buffer.byteLength(html, 'utf8')
  if (remaining <= 0) return html

  const fetchedByUrl = new Map<string, { dataUri: string, encodedBytes: number }>()
  await mapPool(urls, FETCH_CONCURRENCY, async (url) => {
    try {
      const asset = await fetchAsset(url)
      if (!asset?.bytes.length) return
      if (asset.bytes.length > maxAsset) return
      const mime = mimeTypeForAsset(asset.contentType, url)
      if (!mime) return
      const dataUri = dataUriFromAsset(asset.bytes, mime)
      fetchedByUrl.set(url, {
        dataUri,
        encodedBytes: Buffer.byteLength(dataUri, 'utf8')
      })
    } catch {
      // Leave the live URL in place.
    }
  })

  const dataUris = new Map<string, string>()
  for (const url of urls) {
    const item = fetchedByUrl.get(url)
    if (!item) continue
    const occurrences = Math.max(1, html.split(url).length - 1)
    const cost = item.encodedBytes * occurrences
    if (cost > remaining) continue
    remaining -= cost
    dataUris.set(url, item.dataUri)
  }

  if (!dataUris.size) return html
  return replaceHtmlAssetUrls(html, dataUris)
}
