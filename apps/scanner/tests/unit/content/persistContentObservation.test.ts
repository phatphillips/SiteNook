import { describe, expect, it, vi, beforeEach } from 'vitest'
import { persistContentObservation } from '../../../src/content/persistContentObservation.js'

function createPbMock() {
  const blobs = new Map<string, Record<string, unknown>>()
  const observations: Record<string, unknown>[] = []
  let blobCounter = 0
  let obsCounter = 0

  const pb = {
    collection(name: string) {
      if (name === 'sites') {
        return {
          getOne: vi.fn(async () => ({ organization: 'org-1' }))
        }
      }
      if (name === 'page_content_blobs') {
        return {
          getList: vi.fn(async ({ filter }: { filter?: string }) => {
            const hashMatch = filter?.match(/content_hash = "([^"]+)"/)
            const siteMatch = filter?.match(/site = "([^"]+)"/)
            if (!hashMatch || !siteMatch) return { items: [] }
            const found = [...blobs.values()].find(
              b => b.content_hash === hashMatch[1] && b.site === siteMatch[1]
            )
            return { items: found ? [{ id: found.id }] : [] }
          }),
          create: vi.fn(async (data: FormData | Record<string, unknown>) => {
            const id = `blob-${++blobCounter}`
            const record = typeof data === 'object' && !(data instanceof FormData)
              ? { ...data, id }
              : { id, site: 'site-1', content_hash: 'abc' }
            blobs.set(id, record)
            return { id }
          }),
          update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
            const existing = blobs.get(id) ?? { id }
            blobs.set(id, { ...existing, ...patch })
            return { id }
          })
        }
      }
      if (name === 'page_content_observations') {
        return {
          getList: vi.fn(async () => ({ items: [] })),
          create: vi.fn(async (data: Record<string, unknown>) => {
            const id = `obs-${++obsCounter}`
            observations.push({ ...data, id })
            return { id }
          })
        }
      }
      throw new Error(`Unexpected collection ${name}`)
    }
  }

  return { pb: pb as never, observations, blobs }
}

describe('persistContentObservation', () => {
  it('creates blob and observation for new content', async () => {
    const { pb, observations } = createPbMock()
    const result = await persistContentObservation(pb, {
      scanId: 'scan-1',
      siteId: 'site-1',
      pageId: 'page-1',
      pageUrl: 'https://example.com/about',
      title: 'About',
      markdown: '# About\n\nWe help teams.'
    })
    expect(result.unchanged).toBe(false)
    expect(result.blobId).toBeTruthy()
    expect(observations).toHaveLength(1)
    expect(observations[0]?.unchanged).toBe(false)
  })
})
