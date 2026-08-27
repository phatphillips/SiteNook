import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { POLICY_ALL_SITES } from '~/composables/usePolicies'

const mockCollections: Record<string, {
  getFullList: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}> = {}

let usePolicies: typeof import('~/composables/usePolicies').usePolicies

function col(name: string) {
  if (!mockCollections[name]) {
    mockCollections[name] = {
      getFullList: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
  return mockCollections[name]
}

beforeAll(async () => {
  vi.stubGlobal('usePocketBase', () => ({
    pb: {
      collection: (name: string) => col(name)
    },
    requireUser: () => ({ id: 'user-1', organization: 'org-1' })
  }))
  vi.stubGlobal('onMounted', (cb: () => void) => {
    cb()
  })

  const mod = await import('~/composables/usePolicies')
  usePolicies = mod.usePolicies
})

describe('usePolicies', () => {
  beforeEach(() => {
    Object.values(mockCollections).forEach((m) => {
      m.getFullList.mockReset()
      m.getFullList.mockResolvedValue([])
      m.create.mockReset()
      m.update.mockReset()
      m.delete.mockReset()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists policies and includes org-wide when filtering by site', async () => {
    const siteFilter = ref<string | undefined>('site-1')
    col('policies').getFullList.mockResolvedValue([
      { id: 'p1', site: 'site-1', name: 'Brand', pattern: 'acme', enabled: true }
    ])

    const { policies, fetchPolicies } = usePolicies(siteFilter)
    await fetchPolicies()

    expect(col('policies').getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining('site-1'),
        expand: 'site',
        sort: '-created'
      })
    )
    const filter = col('policies').getFullList.mock.calls[0]?.[0]?.filter as string
    expect(filter).toContain('site = null')
    expect(policies.value).toHaveLength(1)
  })

  it('creates org-wide flag policies with empty site and organization', async () => {
    col('policies').create.mockResolvedValue({ id: 'p1', site: '', name: 'Brand' })
    col('policies').getFullList.mockResolvedValue([])

    const { createPolicy } = usePolicies()
    await createPolicy({
      site: POLICY_ALL_SITES,
      name: 'Brand',
      kind: 'flag_content',
      rule_type: 'regex',
      pattern: 'acme',
      category: 'brand',
      severity: 'warning'
    })

    expect(col('policies').create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: 'org-1',
        site: null,
        name: 'Brand',
        kind: 'flag_content',
        pattern: 'acme',
        enabled: true
      })
    )
  })

  it('creates exclude_from_accessibility policies as css_selector', async () => {
    col('policies').create.mockResolvedValue({ id: 'p1', name: 'YouTube embeds' })
    col('policies').getFullList.mockResolvedValue([])

    const { createPolicy } = usePolicies()
    await createPolicy({
      site: POLICY_ALL_SITES,
      name: 'YouTube embeds',
      kind: 'exclude_from_accessibility',
      rule_type: 'keyword',
      pattern: 'iframe[src*="youtube.com"]',
      category: 'qa',
      severity: 'error'
    })

    expect(col('policies').create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'exclude_from_accessibility',
        rule_type: 'css_selector',
        category: 'accessibility',
        pattern: 'iframe[src*="youtube.com"]'
      })
    )
  })

  it('creates site-scoped policies', async () => {
    col('policies').create.mockResolvedValue({ id: 'p1', site: 'site-1', name: 'Test' })
    col('policies').getFullList.mockResolvedValue([])

    const { createPolicy } = usePolicies()
    await createPolicy({
      site: 'site-1',
      name: 'Test',
      kind: 'flag_content',
      rule_type: 'keyword',
      pattern: 'forbidden',
      category: 'brand',
      severity: 'error'
    })

    expect(col('policies').create).toHaveBeenCalledWith(
      expect.objectContaining({
        site: 'site-1',
        organization: 'org-1',
        kind: 'flag_content'
      })
    )
  })

  it('toggles and updates policies', async () => {
    col('policies').update.mockResolvedValue({ id: 'p1', enabled: false })
    col('policies').getFullList.mockResolvedValue([])

    const { togglePolicy, updatePolicy } = usePolicies()
    await togglePolicy('p1', false)
    expect(col('policies').update).toHaveBeenCalledWith('p1', { enabled: false })

    await updatePolicy('p1', { name: 'Renamed' })
    expect(col('policies').update).toHaveBeenCalledWith('p1', { name: 'Renamed' })
  })

  it('reloads when site filter changes', async () => {
    const siteFilter = ref<string | undefined>('site-1')
    col('policies').getFullList.mockResolvedValue([])
    usePolicies(siteFilter)
    await nextTick()
    col('policies').getFullList.mockClear()

    siteFilter.value = 'site-2'
    await nextTick()
    await Promise.resolve()

    expect(col('policies').getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.stringContaining('site-2')
      })
    )
  })
})
