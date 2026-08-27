import { describe, expect, it, vi } from 'vitest'
import { processNextReportJob } from '../../../src/reports/reportWorker.js'

describe('processNextReportJob', () => {
  it('no-ops when there are no pending jobs', async () => {
    const getFullList = vi.fn().mockResolvedValue([])
    const pb = {
      collection: vi.fn(() => ({ getFullList }))
    }
    await processNextReportJob(pb as never)
    expect(getFullList).toHaveBeenCalledWith(expect.objectContaining({
      filter: 'status = "pending"'
    }))
  })

  it('marks jobs failed when no sections are selected', async () => {
    const updates: Record<string, unknown>[] = []
    const pb = {
      collection: vi.fn((name: string) => {
        if (name === 'report_jobs') {
          return {
            getFullList: vi.fn().mockResolvedValue([{
              id: 'job1',
              org: 'org1',
              format: 'pdf',
              include_all_sites: true,
              sections: {
                overview: { accessibility: false, qa: false, seo: false, orgSummary: false },
                accessibility: { pages: false, issues: false, readability: false, pdfs: false },
                qa: { brokenLinks: false, spelling: false, inventory: false },
                seo: { technical: false, content: false, preview: false }
              }
            }]),
            update: vi.fn(async (_id: string, payload: Record<string, unknown>) => {
              updates.push(payload)
              return payload
            })
          }
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          getList: vi.fn().mockResolvedValue({ items: [] }),
          getOne: vi.fn()
        }
      })
    }

    await processNextReportJob(pb as never)
    expect(updates[0]).toMatchObject({
      status: 'failed',
      progress_label: 'Failed'
    })
  })
})
