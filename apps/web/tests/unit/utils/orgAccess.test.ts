import { describe, expect, it } from 'vitest'
import {
  canChangeRole,
  canRemoveMember,
  canToggleBillingContact,
  canWriteOrg,
  formatOrgUserRole,
  getUserOrganizationId,
  isBillingContact,
  isOrgAdmin,
  requireUserOrganizationId
} from '~/utils/orgAccess'

describe('orgAccess', () => {
  it('reads organization id from user record', () => {
    expect(getUserOrganizationId({ organization: 'org123' } as never)).toBe('org123')
    expect(getUserOrganizationId({ organization: '  org456  ' } as never)).toBe('org456')
    expect(getUserOrganizationId({ organization: { id: 'org789' } } as never)).toBe('org789')
    expect(getUserOrganizationId({ organization: '' } as never)).toBeNull()
    expect(getUserOrganizationId(null)).toBeNull()
  })

  it('requires organization id', () => {
    expect(requireUserOrganizationId({ organization: 'org1' } as never)).toBe('org1')
    expect(() => requireUserOrganizationId({ organization: '' } as never)).toThrow(/organization/)
  })

  it('detects org admin role only', () => {
    expect(isOrgAdmin({ role: 'admin' } as never)).toBe(true)
    expect(isOrgAdmin({ role: 'owner' } as never)).toBe(false)
    expect(isOrgAdmin({ role: 'viewer' } as never)).toBe(false)
    expect(isOrgAdmin(null)).toBe(false)
  })

  it('gates org write access to admin only', () => {
    expect(canWriteOrg({ role: 'admin' } as never)).toBe(true)
    expect(canWriteOrg({ role: 'owner' } as never)).toBe(false)
    expect(canWriteOrg({ role: 'viewer' } as never)).toBe(false)
  })

  it('formats org user role labels', () => {
    expect(formatOrgUserRole('admin')).toBe('Admin')
    expect(formatOrgUserRole('viewer')).toBe('Viewer')
    expect(formatOrgUserRole('owner')).toBe('Admin')
    expect(formatOrgUserRole('analyst')).toBe('Viewer')
    expect(formatOrgUserRole('custom')).toBe('custom')
    expect(formatOrgUserRole('')).toBe('—')
  })

  it('detects billing contact flag', () => {
    expect(isBillingContact({ is_billing_contact: true } as never)).toBe(true)
    expect(isBillingContact({ is_billing_contact: false } as never)).toBe(false)
    expect(isBillingContact(null)).toBe(false)
  })

  it('blocks changing role for the last admin', () => {
    const actor = { id: 'admin-2', role: 'admin' }
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true },
      { id: 'viewer-1', role: 'viewer', is_billing_contact: false }
    ]

    expect(canChangeRole(users[0]!, users, 'viewer', actor)).toEqual({
      allowed: false,
      reason: 'This is the last Admin — promote another member before changing this role.'
    })
  })

  it('blocks demoting the sole billing contact admin when another admin exists', () => {
    const actor = { id: 'admin-2', role: 'admin' }
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true },
      { id: 'admin-2', role: 'admin', is_billing_contact: false }
    ]

    expect(canChangeRole(users[0]!, users, 'viewer', actor, { commercial: true })).toEqual({
      allowed: false,
      reason: 'Organization must have at least one billing contact — assign another admin as billing contact first.'
    })
  })

  it('allows demoting a billing-contact admin when commercial billing is off', () => {
    const actor = { id: 'admin-2', role: 'admin' }
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true },
      { id: 'admin-2', role: 'admin', is_billing_contact: false }
    ]

    expect(canChangeRole(users[0]!, users, 'viewer', actor, { commercial: false })).toEqual({
      allowed: true
    })
  })

  it('allows demoting an admin when another admin and billing contact exist', () => {
    const actor = { id: 'admin-2', role: 'admin' }
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: false },
      { id: 'admin-2', role: 'admin', is_billing_contact: true }
    ]

    expect(canChangeRole(users[0]!, users, 'viewer', actor)).toEqual({ allowed: true })
  })

  it('blocks removing the last admin or sole billing contact', () => {
    const actor = { id: 'admin-2', role: 'admin' }
    const singleAdminOrg = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true }
    ]

    expect(canRemoveMember(singleAdminOrg[0]!, singleAdminOrg, actor)).toEqual({
      allowed: false,
      reason: 'Organization must have at least one Admin.'
    })

    const multiAdminSoleBilling = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true },
      { id: 'admin-2', role: 'admin', is_billing_contact: false }
    ]

    expect(canRemoveMember(multiAdminSoleBilling[0]!, multiAdminSoleBilling, actor, { commercial: true })).toEqual({
      allowed: false,
      reason: 'Organization must have at least one billing contact — assign another admin as billing contact first.'
    })

    expect(canRemoveMember(multiAdminSoleBilling[0]!, multiAdminSoleBilling, actor, { commercial: false })).toEqual({
      allowed: true
    })
  })

  it('allows removing an admin when replacements exist', () => {
    const actor = { id: 'admin-3', role: 'admin' }
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: false },
      { id: 'admin-2', role: 'admin', is_billing_contact: true },
      { id: 'admin-3', role: 'admin', is_billing_contact: false }
    ]

    expect(canRemoveMember(users[0]!, users, actor)).toEqual({ allowed: true })
  })

  it('blocks turning off billing contact for the sole billing admin', () => {
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true },
      { id: 'admin-2', role: 'admin', is_billing_contact: false }
    ]

    expect(canToggleBillingContact(users[0]!, users, true, 'admin', { commercial: true })).toEqual({
      allowed: false,
      reason: 'Organization must have at least one billing contact — assign another admin as billing contact first.'
    })
  })

  it('allows billing contact toggle when another billing contact exists', () => {
    const users = [
      { id: 'admin-1', role: 'admin', is_billing_contact: true },
      { id: 'admin-2', role: 'admin', is_billing_contact: true }
    ]

    expect(canToggleBillingContact(users[0]!, users, true, 'admin', { commercial: true })).toEqual({ allowed: true })
  })
})
