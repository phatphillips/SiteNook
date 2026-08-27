import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LIVE_PAGE_FETCH_TIMEOUT_MS,
  clearLivePageHtmlCache,
  fetchLivePageHtml
} from '../../../server/utils/fetchLivePageHtml'

describe('fetchLivePageHtml', () => {
  beforeEach(() => {
    clearLivePageHtmlCache()
  })

  afterEach(() => {
    clearLivePageHtmlCache()
    vi.useRealTimers()
  })

  it('returns live HTML and caches the next call', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => Buffer.from('<html><body>Live</body></html>')
    })) as unknown as typeof fetch

    const first = await fetchLivePageHtml('https://example.gov/', fetchImpl)
    const second = await fetchLivePageHtml('https://example.gov/', fetchImpl)
    expect(first).toContain('Live')
    expect(second).toContain('Live')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns null when the live fetch hangs past the timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    const pending = fetchLivePageHtml('https://example.gov/slow', fetchImpl)
    await vi.advanceTimersByTimeAsync(LIVE_PAGE_FETCH_TIMEOUT_MS + 500)
    await expect(pending).resolves.toBeNull()
    const again = await fetchLivePageHtml('https://example.gov/slow', fetchImpl)
    expect(again).toBeNull()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('peeks only cached HTML and prefetches a few live requests at a time', async () => {
    const { peekLivePageHtml, prefetchLivePageHtml } = await import('../../../server/utils/fetchLivePageHtml')
    expect(peekLivePageHtml('https://example.gov/')).toBeUndefined()
    const hung = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    prefetchLivePageHtml('https://example.gov/a', hung)
    prefetchLivePageHtml('https://example.gov/b', hung)
    prefetchLivePageHtml('https://example.gov/c', hung)
    prefetchLivePageHtml('https://example.gov/d', hung)
    expect(hung).toHaveBeenCalledTimes(3)
  })

  it('retries a trailing-slash URL after a 404', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/page/')) {
        return {
          ok: true,
          url: String(url),
          arrayBuffer: async () => Buffer.from('<html><body>canonical page</body></html>')
        }
      }
      return { ok: false, status: 404, arrayBuffer: async () => Buffer.from('missing') }
    }) as unknown as typeof fetch

    const html = await fetchLivePageHtml('https://example.gov/page', fetchImpl)
    expect(html).toContain('canonical page')
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1)
  })
})
