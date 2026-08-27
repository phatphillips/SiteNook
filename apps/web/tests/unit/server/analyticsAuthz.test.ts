import { describe, expect, it } from 'vitest'
import { requireOrgAdmin, isAnalyticsProvider, sanitizeConnection } from '../../../server/utils/analytics/connections'

describe('analytics connection authz helpers', () => {
  it('requireOrgAdmin allows admins only', () => {
    expect(() => requireOrgAdmin({ role: 'admin' })).not.toThrow()
    expect(() => requireOrgAdmin({ role: 'viewer' })).toThrow()
    expect(() => requireOrgAdmin({ role: 'owner' })).toThrow()
  })

  it('isAnalyticsProvider validates enum', () => {
    expect(isAnalyticsProvider('ga4')).toBe(true)
    expect(isAnalyticsProvider('plausible')).toBe(true)
    expect(isAnalyticsProvider('segment')).toBe(false)
  })

  it('sanitizeConnection strips encrypted credentials', () => {
    const sanitized = sanitizeConnection({
      id: 'c1',
      organization: 'o1',
      site: 's1',
      provider: 'fathom',
      status: 'connected',
      credentials_encrypted: 'SECRET',
      credentials_meta: { last4: '1234' },
      created: '2026-01-01',
      updated: '2026-01-01'
    })
    expect(sanitized).not.toHaveProperty('credentials_encrypted')
    expect(sanitized.credentials_meta?.last4).toBe('1234')
  })
})
