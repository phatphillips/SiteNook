import { describe, it, expect } from 'vitest'
import { decodePasswordResetTokenEmail } from '~/utils/resetToken'

describe('decodePasswordResetTokenEmail', () => {
  it('extracts email from a PocketBase password-reset JWT payload', () => {
    const payload = btoa(JSON.stringify({
      email: 'puffinpopstop@gmail.com',
      type: 'passwordReset'
    }))
    const token = `header.${payload}.signature`

    expect(decodePasswordResetTokenEmail(token)).toBe('puffinpopstop@gmail.com')
  })

  it('returns null for invalid tokens', () => {
    expect(decodePasswordResetTokenEmail('')).toBeNull()
    expect(decodePasswordResetTokenEmail('not-a-jwt')).toBeNull()
  })
})
