import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SiteNookClient, SiteNookApiError } from '../src/client'

describe('SiteNookClient', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls list sites with Bearer API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ items: [{ id: 's1', name: 'Demo' }] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new SiteNookClient({
      baseUrl: 'http://localhost:3000/',
      apiKey: 'ak_test'
    })
    const result = await client.listSites()
    expect(result.items).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer ak_test'
        })
      })
    )
    const url = fetchMock.mock.calls[0][0] as URL
    expect(url.toString()).toBe('http://localhost:3000/api/agent/sites')
  })

  it('throws SiteNookApiError on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ statusMessage: 'Invalid API key' })
    }))

    const client = new SiteNookClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'ak_bad'
    })
    await expect(client.listSites()).rejects.toBeInstanceOf(SiteNookApiError)
    await expect(client.listSites()).rejects.toMatchObject({
      status: 401,
      message: 'Invalid API key'
    })
  })
})
