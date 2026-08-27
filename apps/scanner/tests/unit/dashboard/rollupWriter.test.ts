import { describe, it, expect, vi } from 'vitest'
import {
  recomputeOrgDashboardSummary,
  recomputeSiteDashboardSummary
} from '../../../src/dashboard/rollupWriter.js'

function mockPb() {
  const create = vi.fn().mockResolvedValue({})
  const update = vi.fn().mockResolvedValue({})
  const getList = vi.fn().mockImplementation((_page: number, _perPage: number, opts?: { filter?: string }) => {
    const filter = opts?.filter || ''
    if (filter.includes('site = "site-1"') && filter.includes('status')) {
      return Promise.resolve({
        items: [{
          id: 'scan-1',
          score_overall: 80,
          score_qa: 70,
          score_seo: 60,
          open_issue_count: 5,
          completed_at: '2026-07-01T10:00:00.000Z'
        }]
      })
    }
    if (filter.includes('scan = "scan-1"') && filter.includes('qa_broken_links')) {
      return Promise.resolve({ totalItems: 2, items: [] })
    }
    if (filter.includes('scan = "scan-1"') && filter.includes('qa_spelling')) {
      return Promise.resolve({ totalItems: 1, items: [] })
    }
    if (filter.includes('scan = "scan-1"') && filter.includes('seo_issues')) {
      return Promise.resolve({ totalItems: 3, items: [] })
    }
    if (filter.includes('site = "site-1"') && filter.includes('site_dashboard_summary')) {
      return Promise.resolve({ items: [{ id: 'summary-1' }] })
    }
    if (filter.includes('org = "org-1"') && filter.includes('org_dashboard_summary')) {
      return Promise.resolve({ items: [{ id: 'org-summary-1' }] })
    }
    return Promise.resolve({ items: [], totalItems: 0 })
  })

  const getFullList = vi.fn().mockResolvedValue([
    {
      avg_accessibility: 80,
      avg_qa: 70,
      avg_seo: 60,
      open_a11y_count: 5,
      open_qa_count: 3,
      open_seo_count: 3,
      attention_worst_score: 60,
      attention_last_scan_at: '2026-07-01T10:00:00.000Z',
      source_scan_at: '2026-07-01T10:00:00.000Z'
    },
    {
      avg_accessibility: 50,
      avg_qa: 40,
      avg_seo: 30,
      open_a11y_count: 2,
      open_qa_count: 1,
      open_seo_count: 0,
      attention_worst_score: 30,
      attention_last_scan_at: '2026-07-02T10:00:00.000Z',
      source_scan_at: '2026-07-02T10:00:00.000Z'
    }
  ])
  const getOne = vi.fn().mockResolvedValue({ id: 'site-1', organization: 'org-1' })

  return {
    collection: vi.fn((name: string) => ({
      create,
      update,
      getList: vi.fn((page: number, perPage: number, opts?: { filter?: string }) => {
        const scopedFilter = `${name}:${opts?.filter || ''}`
        return getList(page, perPage, { filter: scopedFilter })
      }),
      getFullList,
      getOne
    })),
    _update: update
  }
}

describe('rollupWriter', () => {
  it('recomputes site summary using latest scan and open counts', async () => {
    const pb = mockPb() as never
    await recomputeSiteDashboardSummary(pb, 'site-1')
    const update = (pb as { _update: ReturnType<typeof vi.fn> })._update
    expect(update).toHaveBeenCalledWith(
      'summary-1',
      expect.objectContaining({
        site: 'site-1',
        org: 'org-1',
        avg_accessibility: 80,
        avg_qa: 70,
        avg_seo: 60,
        open_a11y_count: 5
      })
    )
  })

  it('recomputes org summary from site summaries', async () => {
    const pb = mockPb() as never
    await recomputeOrgDashboardSummary(pb, 'org-1')
    const update = (pb as { _update: ReturnType<typeof vi.fn> })._update
    expect(update).toHaveBeenCalledWith(
      'org-summary-1',
      expect.objectContaining({
        org: 'org-1',
        avg_accessibility: 65,
        avg_qa: 55,
        avg_seo: 45,
        open_a11y_count: 7,
        attention_worst_score: 30
      })
    )
  })
})
