import { describe, it, expect } from 'vitest'
import { generateInvitePassword } from '~/utils/inviteUser'

describe('generateInvitePassword', () => {
  it('returns a password at least 8 characters', () => {
    const password = generateInvitePassword()
    expect(password.length).toBeGreaterThanOrEqual(8)
  })

  it('generates unique values', () => {
    const a = generateInvitePassword()
    const b = generateInvitePassword()
    expect(a).not.toBe(b)
  })

  it('uses ASCII-only characters', () => {
    expect(generateInvitePassword()).toMatch(/^[\x21-\x7E]+$/)
  })
})
