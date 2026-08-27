import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resetPdfBackfillStateForTests,
  storeOneMissingCrawlPdfFile
} from '../../../src/pdf/pdfValidationWorker.js'

afterEach(() => {
  resetPdfBackfillStateForTests()
  delete process.env.SCANNER_PDF_STORE_BACKFILL
  vi.restoreAllMocks()
})

describe('storeOneMissingCrawlPdfFile', () => {
  it('skips docs that previously hard-failed (403) instead of retrying every poll', async () => {
    process.env.SCANNER_PDF_STORE_BACKFILL = '1'
    const update = vi.fn()
    const getList = vi.fn(async () => ({
      items: [
        {
          id: 'sharepoint-doc',
          source: 'crawl',
          file: '',
          url: 'https://tasedu.sharepoint.com/doc.pdf'
        }
      ]
    }))

    const pb = {
      collection: (name: string) => {
        expect(name).toBe('pdf_documents')
        return {
          getList,
          update,
          getOne: vi.fn()
        }
      },
      files: { getUrl: vi.fn() },
      authStore: { token: '' }
    } as never

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 })
    )

    const first = await storeOneMissingCrawlPdfFile(pb)
    expect(first).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Immediate retry should hit cooldown and not fetch again.
    const second = await storeOneMissingCrawlPdfFile(pb)
    expect(second).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns false without error when no crawl PDFs are missing files', async () => {
    process.env.SCANNER_PDF_STORE_BACKFILL = '1'
    const pb = {
      collection: () => ({
        getList: vi.fn(async () => ({
          items: [
            {
              id: 'has-file',
              source: 'crawl',
              file: 'stored.pdf',
              url: 'https://example.com/a.pdf'
            }
          ]
        }))
      })
    } as never

    await expect(storeOneMissingCrawlPdfFile(pb)).resolves.toBe(false)
  })
})
