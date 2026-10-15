import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  brokenLinkStatusForRecheck,
  checkBrokenLinkUrl
} from '../../../server/utils/checkBrokenLink'

describe('brokenLinkStatusForRecheck', () => {
  it('keeps broken as broken and maps ok/redirected to redirected for storage', () => {
    expect(brokenLinkStatusForRecheck('broken')).toBe('broken')
    expect(brokenLinkStatusForRecheck('ok')).toBe('redirected')
    expect(brokenLinkStatusForRecheck('redirected')).toBe('redirected')
  })
})

describe('checkBrokenLinkUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('classifies 404 as broken', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 404 })))
    const result = await checkBrokenLinkUrl('https://example.com/missing', 'https://example.com')
    expect(result).toEqual({
      href: 'https://example.com/missing',
      status_code: 404,
      status: 'broken',
      link_type: 'internal'
    })
  })

  it('classifies 2xx as ok and external when origin differs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })))
    const result = await checkBrokenLinkUrl('https://cdn.example.org/a.css', 'https://example.com')
    expect(result.status).toBe('ok')
    expect(result.status_code).toBe(200)
    expect(result.link_type).toBe('external')
  })

  it('falls back to GET when HEAD returns 405', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return { status: 405 }
      return { status: 200 }
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await checkBrokenLinkUrl('https://example.com/page', 'https://example.com')
    expect(result.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns broken with status_code 0 on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network')
    }))
    const result = await checkBrokenLinkUrl('https://example.com/down', 'https://example.com')
    expect(result).toMatchObject({
      status: 'broken',
      status_code: 0,
      link_type: 'internal'
    })
  })
})
