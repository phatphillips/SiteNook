import dns from 'node:dns'
import { livePageUrlCandidates } from '~/utils/livePreviewHtml'

try {
  dns.setDefaultResultOrder('ipv4first')
} catch {
  // Node versions without setDefaultResultOrder.
}

export const LIVE_PAGE_FETCH_TIMEOUT_MS = 8_000
export const LIVE_PAGE_HTML_MAX_BYTES = 2_500_000
export const LIVE_PAGE_CACHE_TTL_MS = 5 * 60 * 1000
export const LIVE_PAGE_NEGATIVE_CACHE_TTL_MS = 60_000
const LIVE_PAGE_CACHE_MAX = 40

const VISITOR_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

type LivePageDocument = { html: string, finalUrl: string }
type CacheEntry = { html: string | null, finalUrl?: string, expires: number }

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<LivePageDocument | null>>()

export function clearLivePageHtmlCache() {
  cache.clear()
  pending.clear()
}

function readCache(pageUrl: string): CacheEntry | null {
  const hit = cache.get(pageUrl)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    cache.delete(pageUrl)
    return null
  }
  return hit
}

function writeCache(pageUrl: string, html: string | null, finalUrl?: string) {
  const ttl = html ? LIVE_PAGE_CACHE_TTL_MS : LIVE_PAGE_NEGATIVE_CACHE_TTL_MS
  cache.set(pageUrl, { html, finalUrl: html ? finalUrl : undefined, expires: Date.now() + ttl })
  while (cache.size > LIVE_PAGE_CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (!oldest) break
    cache.delete(oldest)
  }
}

async function fetchOneLivePage(
  pageUrl: string,
  fetchImpl: typeof fetch
): Promise<{ kind: 'ok', html: string, finalUrl: string } | { kind: 'http', status: number } | { kind: 'fail' }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LIVE_PAGE_FETCH_TIMEOUT_MS)
  const timedOut = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), LIVE_PAGE_FETCH_TIMEOUT_MS + 250)
  })

  const work = (async () => {
    try {
      const response = await fetchImpl(pageUrl, {
        redirect: 'follow',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': VISITOR_USER_AGENT
        },
        signal: controller.signal
      })
      if (!response.ok) return { kind: 'http' as const, status: response.status }
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.byteLength > LIVE_PAGE_HTML_MAX_BYTES) return { kind: 'fail' as const }
      const html = buffer.toString('utf8')
      if (!html.trim()) return { kind: 'fail' as const }
      const finalUrl = typeof response.url === 'string' && response.url ? response.url : pageUrl
      return { kind: 'ok' as const, html, finalUrl }
    } catch {
      return { kind: 'fail' as const }
    }
  })()

  try {
    const result = await Promise.race([work, timedOut])
    if (result === 'timeout') {
      controller.abort()
      return { kind: 'fail' }
    }
    return result
  } finally {
    clearTimeout(timer)
  }
}

async function fetchLivePageDocumentUncached(
  pageUrl: string,
  fetchImpl: typeof fetch
): Promise<LivePageDocument | null> {
  const candidates = livePageUrlCandidates(pageUrl)
  for (let i = 0; i < candidates.length; i++) {
    const outcome = await fetchOneLivePage(candidates[i], fetchImpl)
    if (outcome.kind === 'ok') {
      writeCache(pageUrl, outcome.html, outcome.finalUrl)
      return { html: outcome.html, finalUrl: outcome.finalUrl }
    }
    if (outcome.kind === 'fail') {
      writeCache(pageUrl, null)
      return null
    }
    // HTTP error: try slash/www variants before giving up.
  }
  writeCache(pageUrl, null)
  return null
}

export async function fetchLivePageDocument(
  pageUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<LivePageDocument | null> {
  if (!pageUrl) return null
  const cached = readCache(pageUrl)
  if (cached) {
    return cached.html ? { html: cached.html, finalUrl: cached.finalUrl || pageUrl } : null
  }

  const existing = pending.get(pageUrl)
  if (existing) return existing

  const request = fetchLivePageDocumentUncached(pageUrl, fetchImpl).finally(() => {
    pending.delete(pageUrl)
  })
  pending.set(pageUrl, request)
  return request
}

export async function fetchLivePageHtml(
  pageUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const doc = await fetchLivePageDocument(pageUrl, fetchImpl)
  return doc?.html ?? null
}

/** Cached live HTML only. `undefined` means not fetched yet. */
export function peekLivePageHtml(pageUrl: string): string | null | undefined {
  if (!pageUrl) return undefined
  const cached = readCache(pageUrl)
  if (!cached) return undefined
  return cached.html
}

export function peekLivePageDocument(pageUrl: string): LivePageDocument | null | undefined {
  if (!pageUrl) return undefined
  const cached = readCache(pageUrl)
  if (!cached) return undefined
  if (!cached.html) return null
  return { html: cached.html, finalUrl: cached.finalUrl || pageUrl }
}

const PREFETCH_MAX_IN_FLIGHT = 3

/** Warm the cache without blocking the preview response. */
export function prefetchLivePageHtml(pageUrl: string, fetchImpl: typeof fetch = fetch): void {
  if (!pageUrl) return
  if (readCache(pageUrl) || pending.has(pageUrl)) return
  if (pending.size >= PREFETCH_MAX_IN_FLIGHT) return
  void fetchLivePageHtml(pageUrl, fetchImpl)
}
