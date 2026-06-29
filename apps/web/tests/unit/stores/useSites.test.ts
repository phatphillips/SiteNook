import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref } from 'vue'

const mockGetFullList = vi.fn()
const mockGetOne = vi.fn()
const mockUpdate = vi.fn()
const mockRequireUser = vi.fn(() => ({ id: 'user-1' }))

let useSites: typeof import('~/composables/useSites').useSites

beforeAll(async () => {
  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      collection: () => ({
        getFullList: mockGetFullList,
        getOne: mockGetOne,
        create: vi.fn(),
        update: mockUpdate,
        delete: vi.fn()
      })
    },
    requireUser: mockRequireUser,
    awaitAuthReady: vi.fn().mockResolvedValue(undefined),
    syncAuth: vi.fn()
  }))

  vi.stubGlobal('useTenantOrg', () => ({
    organization: ref({ id: 'org-1', plan: 'team' })
  }))

  const mod = await import('~/composables/useSites')
  useSites = mod.useSites
})

describe('useSites', () => {
  beforeEach(() => {
    mockGetFullList.mockReset()
    mockGetOne.mockReset()
    mockUpdate.mockReset()
    mockRequireUser.mockClear()
  })

  it('initial state is an empty list', () => {
    const { sites } = useSites()

    expect(sites.value).toEqual([])
  })

  it('populates sites after a mock fetch resolves', async () => {
    mockGetFullList.mockResolvedValue([
      { id: 'site-1', name: 'Example', url: 'https://example.com' }
    ])

    const { sites, fetchSites } = useSites()
    await fetchSites()

    expect(sites.value).toHaveLength(1)
    expect(sites.value[0].name).toBe('Example')
    expect(mockGetFullList).toHaveBeenCalledWith({ sort: 'name' })
  })

  it('does not throw when PocketBase returns an empty collection', async () => {
    mockGetFullList.mockResolvedValue([])

    const { sites, fetchSites } = useSites()

    await expect(fetchSites()).resolves.toBeUndefined()
    expect(sites.value).toEqual([])
  })

  it('saveSiteSettings patches local site_settings from the update response', async () => {
    const settings = { wcagVersion: '2.0', wcagConformance: 'A', bestPractices: false }
    mockGetFullList.mockResolvedValue([
      { id: 'site-1', name: 'Example', url: 'https://example.com' }
    ])
    mockUpdate.mockResolvedValue({
      id: 'site-1',
      name: 'Example',
      url: 'https://example.com',
      site_settings: settings
    })

    const { sites, fetchSites, saveSiteSettings } = useSites()
    await fetchSites()
    await saveSiteSettings('site-1', settings)

    expect(mockUpdate).toHaveBeenCalledWith('site-1', { site_settings: settings })
    expect(sites.value[0]?.site_settings).toEqual(settings)
  })

  it('refreshSite loads a single site into the shared list', async () => {
    const site = {
      id: 'site-1',
      name: 'Example',
      url: 'https://example.com',
      site_settings: { wcagVersion: '2.1', wcagConformance: 'AA' }
    }
    mockGetOne.mockResolvedValue(site)

    const { sites, refreshSite } = useSites()
    const loaded = await refreshSite('site-1')

    expect(mockGetOne).toHaveBeenCalledWith('site-1')
    expect(loaded.site_settings).toEqual(site.site_settings)
    expect(sites.value).toEqual([site])
  })

  it('fetchSites preserves local site_settings when list response omits them', async () => {
    const settings = { wcagVersion: '2.0', wcagConformance: 'A' }
    mockGetFullList
      .mockResolvedValueOnce([{ id: 'site-1', name: 'Example', url: 'https://example.com', site_settings: settings }])
      .mockResolvedValueOnce([{ id: 'site-1', name: 'Example', url: 'https://example.com' }])

    const { sites, fetchSites } = useSites()
    await fetchSites()
    await fetchSites()

    expect(sites.value[0]?.site_settings).toEqual(settings)
  })
})
