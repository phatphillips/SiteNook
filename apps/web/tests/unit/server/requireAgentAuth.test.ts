import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvent } from 'h3'

const {
  mockFindApiKeyBySecret,
  mockGetPbAdmin,
  mockRequirePbUser,
  mockTouch
} = vi.hoisted(() => ({
  mockFindApiKeyBySecret: vi.fn(),
  mockGetPbAdmin: vi.fn(),
  mockRequirePbUser: vi.fn(),
  mockTouch: vi.fn()
}))

vi.mock('../../../server/utils/pbAdmin', () => ({
  getPbAdmin: mockGetPbAdmin
}))

vi.mock('../../../server/utils/requirePbUser', () => ({
  requirePbUser: mockRequirePbUser,
  clearPbUserAuthCache: vi.fn()
}))

vi.mock('../../../server/utils/apiKeys', async () => {
  const actual = await vi.importActual<typeof import('../../../server/utils/apiKeys')>('../../../server/utils/apiKeys')
  return {
    ...actual,
    findApiKeyBySecret: mockFindApiKeyBySecret,
    touchApiKeyLastUsed: mockTouch
  }
})

vi.mock('pocketbase', () => ({
  default: class MockPocketBase {
    authStore = { save: vi.fn() }
    autoCancellation = vi.fn()
  }
}))

describe('requireAgentAuth', () => {
  beforeEach(() => {
    mockFindApiKeyBySecret.mockReset()
    mockGetPbAdmin.mockReset()
    mockRequirePbUser.mockReset()
    mockTouch.mockReset()
    vi.stubGlobal('useRuntimeConfig', () => ({
      pocketbaseUrl: 'http://pocketbase:8090',
      public: { pocketbaseUrl: 'http://localhost:8090' }
    }))
  })

  it('rejects missing Authorization', async () => {
    const { requireAgentAuth } = await import('../../../server/utils/requireAgentAuth')
    const event = createEvent({ method: 'GET', url: '/api/agent/sites' })
    await expect(requireAgentAuth(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('authenticates API keys via admin lookup', async () => {
    const adminPb = { id: 'admin-pb' }
    mockGetPbAdmin.mockResolvedValue(adminPb)
    mockFindApiKeyBySecret.mockResolvedValue({
      id: 'key1',
      organization: 'org1',
      name: 'MCP',
      key_prefix: 'ak_live_',
      key_hash: 'abc',
      scopes: ['read', 'write']
    })

    const { requireAgentAuth } = await import('../../../server/utils/requireAgentAuth')
    const event = createEvent({
      method: 'GET',
      url: '/api/agent/sites',
      headers: { authorization: 'Bearer ak_live_testsecretvalue123456' }
    })

    const ctx = await requireAgentAuth(event)
    expect(ctx.authMode).toBe('api_key')
    expect(ctx.orgId).toBe('org1')
    expect(ctx.canWrite).toBe(true)
    expect(ctx.pb).toBe(adminPb)
    expect(mockTouch).toHaveBeenCalled()
  })

  it('rejects unknown API keys', async () => {
    mockGetPbAdmin.mockResolvedValue({})
    mockFindApiKeyBySecret.mockResolvedValue(null)
    const { requireAgentAuth } = await import('../../../server/utils/requireAgentAuth')
    const event = createEvent({
      method: 'GET',
      url: '/api/agent/sites',
      headers: { authorization: 'Bearer ak_live_unknownunknownunknown' }
    })
    await expect(requireAgentAuth(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('falls back to user JWT auth', async () => {
    mockRequirePbUser.mockResolvedValue({
      id: 'u1',
      organization: 'org9',
      role: 'admin'
    })
    const { requireAgentAuth } = await import('../../../server/utils/requireAgentAuth')
    const event = createEvent({
      method: 'GET',
      url: '/api/agent/sites',
      headers: { authorization: 'Bearer user-jwt-token' }
    })
    const ctx = await requireAgentAuth(event)
    expect(ctx.authMode).toBe('user')
    expect(ctx.orgId).toBe('org9')
    expect(ctx.canWrite).toBe(true)
  })

  it('marks viewer JWT as read-only', async () => {
    mockRequirePbUser.mockResolvedValue({
      id: 'u2',
      organization: 'org9',
      role: 'viewer'
    })
    const { requireAgentAuth } = await import('../../../server/utils/requireAgentAuth')
    const event = createEvent({
      method: 'GET',
      url: '/api/agent/sites',
      headers: { authorization: 'Bearer viewer-jwt' }
    })
    const ctx = await requireAgentAuth(event)
    expect(ctx.canWrite).toBe(false)
  })
})
