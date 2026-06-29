import { describe, expect, it } from 'vitest'
import {
  assertDevTenantResetAllowed,
  assertPurgeForceAllowed,
  buildClosingOrganizationsFilter
} from '../../../src/db/purgeClosedOrgs.js'

describe('purgeClosedOrgs', () => {
  const fixedNow = new Date('2026-06-15T12:00:00.000Z')

  it('builds default filter with retention window', () => {
    const filter = buildClosingOrganizationsFilter({ now: fixedNow })
    expect(filter).toContain('purge_scheduled_at != ""')
    expect(filter).toContain('purge_scheduled_at <= "2026-06-15T12:00:00.000Z"')
    expect(filter).not.toContain('status = "closing"')
  })

  it('builds force filter without date check', () => {
    const filter = buildClosingOrganizationsFilter({ force: true, now: fixedNow })
    expect(filter).toBe('purge_scheduled_at != ""')
  })

  it('builds org-id filter', () => {
    const filter = buildClosingOrganizationsFilter({
      organizationId: 'org123',
      now: fixedNow
    })
    expect(filter).toContain('id = "org123"')
    expect(filter).toContain('purge_scheduled_at <=')
  })

  it('builds org-id + force filter', () => {
    const filter = buildClosingOrganizationsFilter({
      organizationId: 'org123',
      force: true
    })
    expect(filter).toBe('purge_scheduled_at != "" && id = "org123"')
  })

  it('blocks --force in production without override', () => {
    const prevNode = process.env.NODE_ENV
    const prevForce = process.env.PURGE_ALLOW_FORCE
    process.env.NODE_ENV = 'production'
    delete process.env.PURGE_ALLOW_FORCE
    expect(() => assertPurgeForceAllowed(true)).toThrow(/disabled in production/)
    process.env.NODE_ENV = prevNode
    process.env.PURGE_ALLOW_FORCE = prevForce
  })

  it('allows --force in non-production', () => {
    const prevNode = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    expect(() => assertPurgeForceAllowed(true)).not.toThrow()
    process.env.NODE_ENV = prevNode
  })
})

describe('resetDevTenants guards', () => {
  it('blocks dev reset in production without override', () => {
    const prevNode = process.env.NODE_ENV
    const prevAllow = process.env.RESET_DEV_ALLOW
    process.env.NODE_ENV = 'production'
    delete process.env.RESET_DEV_ALLOW
    expect(() => assertDevTenantResetAllowed()).toThrow(/disabled in production/)
    process.env.NODE_ENV = prevNode
    process.env.RESET_DEV_ALLOW = prevAllow
  })
})
