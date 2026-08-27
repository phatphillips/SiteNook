import { describe, expect, it, vi } from 'vitest'
import { createPageRecord } from '../../../src/db/createPageRecord.js'

describe('createPageRecord', () => {
  it('returns the first create when PocketBase accepts the full payload', async () => {
    const create = vi.fn(async (data: Record<string, unknown>) => ({ id: 'page1', ...data }))
    const pb = { collection: () => ({ create }) } as never
    const record = await createPageRecord(pb, {
      scan: 's1',
      url: 'https://example.test/page',
      html_snapshot: '<html></html>',
      tab_order: [{ selector: 'a' }]
    })
    expect(record.id).toBe('page1')
    expect(create).toHaveBeenCalledOnce()
  })

  it('retries without snapshot/json fields when the first create fails', async () => {
    const create = vi.fn(async (data: Record<string, unknown>) => {
      if (data.html_snapshot) {
        throw { message: 'Something went wrong while processing your request.' }
      }
      return { id: 'page-slim', ...data }
    })
    const pb = { collection: () => ({ create }) } as never
    const record = await createPageRecord(pb, {
      scan: 's1',
      site: 'site1',
      url: 'https://example.test/heavy',
      title: 'Heavy',
      status_code: 200,
      word_count: 12,
      readability_score: 50,
      crawl_depth: 1,
      html_snapshot: '<html>huge</html>',
      html_size_bytes: 9_000_000,
      tab_order: [{ selector: 'a' }],
      seo_snapshot: { title: 'x' }
    })
    expect(record.id).toBe('page-slim')
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      url: 'https://example.test/heavy',
      html_snapshot: '',
      html_size_bytes: 9_000_000
    })
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('tab_order')
    expect(create.mock.calls[1]?.[0]).not.toHaveProperty('seo_snapshot')
  })
})
