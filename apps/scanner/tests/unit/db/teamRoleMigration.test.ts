import { describe, it, expect } from 'vitest'

describe('team role migration mapping', () => {
  it('maps legacy roles to admin/viewer with billing contact rules', () => {
    const cases = [
      { input: { role: 'owner' }, expected: { role: 'admin', is_billing_contact: true } },
      { input: { role: 'admin' }, expected: { role: 'admin', is_billing_contact: false } },
      { input: { role: 'analyst' }, expected: { role: 'viewer', is_billing_contact: false } },
      { input: { role: 'viewer' }, expected: { role: 'viewer', is_billing_contact: false } }
    ] as const

    for (const testCase of cases) {
      const migrated = migrateLegacyUserRole(testCase.input.role)
      expect(migrated).toEqual(testCase.expected)
    }
  })
})

/** Mirrors services/pocketbase/patch-users.sh one-time role migration. */
function migrateLegacyUserRole(role: string): { role: 'admin' | 'viewer', is_billing_contact: boolean } {
  if (role === 'owner') {
    return { role: 'admin', is_billing_contact: true }
  }
  if (role === 'analyst') {
    return { role: 'viewer', is_billing_contact: false }
  }
  if (role === 'admin') {
    return { role: 'admin', is_billing_contact: false }
  }
  return { role: 'viewer', is_billing_contact: false }
}
