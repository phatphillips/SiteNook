import { describe, expect, it } from 'vitest'
import {
  formatTenantLoginExample,
  parseTenantOnlyFlag,
  resolveTenantOnlyApexRedirect,
  shouldEnforceTenantOnlyApex,
  TENANT_ONLY_APEX_PATHS
} from '~/utils/tenantOnlyApex'

describe('parseTenantOnlyFlag', () => {
  it('accepts common truthy strings', () => {
    expect(parseTenantOnlyFlag('true')).toBe(true)
    expect(parseTenantOnlyFlag('1')).toBe(true)
    expect(parseTenantOnlyFlag('yes')).toBe(true)
    expect(parseTenantOnlyFlag(true)).toBe(true)
  })

  it('rejects falsey values', () => {
    expect(parseTenantOnlyFlag('false')).toBe(false)
    expect(parseTenantOnlyFlag('')).toBe(false)
    expect(parseTenantOnlyFlag(undefined)).toBe(false)
  })
})

describe('shouldEnforceTenantOnlyApex', () => {
  it('blocks production apex when tenant-only is enabled', () => {
    expect(shouldEnforceTenantOnlyApex(true, true, 'sitenook.com')).toBe(true)
  })

  it('does not block localhost apex in dev', () => {
    expect(shouldEnforceTenantOnlyApex(true, true, 'localhost')).toBe(false)
  })

  it('does not block tenant hosts', () => {
    expect(shouldEnforceTenantOnlyApex(true, false, 'sitenook.com')).toBe(false)
  })
})

describe('resolveTenantOnlyApexRedirect', () => {
  it('redirects apex dashboard paths to sign-in in production tenant-only mode', () => {
    expect(resolveTenantOnlyApexRedirect('/', true, true, 'sitenook.com')).toBe('/sign-in')
    expect(resolveTenantOnlyApexRedirect('/login', true, true, 'sitenook.com')).toBe('/sign-in')
    expect(resolveTenantOnlyApexRedirect('/sites', true, true, 'sitenook.com')).toBe('/sign-in')
  })

  it('allows public apex paths', () => {
    expect(TENANT_ONLY_APEX_PATHS.has('/start')).toBe(true)
    for (const path of TENANT_ONLY_APEX_PATHS) {
      expect(resolveTenantOnlyApexRedirect(path, true, true, 'sitenook.com')).toBeNull()
    }
  })

  it('allows marketing paths when marketing site is enabled', () => {
    expect(resolveTenantOnlyApexRedirect('/', true, true, 'sitenook.com', true)).toBeNull()
    expect(resolveTenantOnlyApexRedirect('/pricing', true, true, 'sitenook.com', true)).toBeNull()
    expect(resolveTenantOnlyApexRedirect('/download', true, true, 'sitenook.com', true)).toBeNull()
    expect(TENANT_ONLY_APEX_PATHS.has('/download')).toBe(true)
  })

  it('allows sign-in on apex when tenant-only is enabled', () => {
    expect(resolveTenantOnlyApexRedirect('/sign-in', true, true, 'sitenook.com')).toBeNull()
  })

  it('redirects apex root to sign-in without marketing site', () => {
    expect(resolveTenantOnlyApexRedirect('/', true, true, 'sitenook.com', false)).toBe('/sign-in')
  })

  it('does not redirect when flag is off or host is localhost apex', () => {
    expect(resolveTenantOnlyApexRedirect('/login', false, true, 'sitenook.com')).toBeNull()
    expect(resolveTenantOnlyApexRedirect('/login', true, true, 'localhost')).toBeNull()
  })
})

describe('formatTenantLoginExample', () => {
  it('formats production and dev examples', () => {
    expect(formatTenantLoginExample('sitenook.com')).toBe('your-organization.sitenook.com')
    expect(formatTenantLoginExample('localhost')).toBe('your-organization.localhost')
  })
})
