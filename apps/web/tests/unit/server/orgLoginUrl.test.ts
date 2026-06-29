import { describe, expect, it } from 'vitest'
import {
  appendEmailToLoginUrl,
  buildSignInFallbackUrl,
  isValidOrgLoginEmail
} from '../../../server/utils/orgLoginUrl'

describe('orgLoginUrl', () => {
  it('validates email addresses', () => {
    expect(isValidOrgLoginEmail('you@company.com')).toBe(true)
    expect(isValidOrgLoginEmail('bad')).toBe(false)
    expect(isValidOrgLoginEmail('')).toBe(false)
  })

  it('builds sign-in fallback url', () => {
    expect(buildSignInFallbackUrl('http://localhost:3000/'))
      .toBe('http://localhost:3000/sign-in?status=unknown')
  })

  it('appends email to tenant login url', () => {
    expect(appendEmailToLoginUrl('http://monkey.localhost:3000/login', 'You@Company.com'))
      .toBe('http://monkey.localhost:3000/login?email=you%40company.com')
  })

  it('preserves existing query params when appending email', () => {
    expect(appendEmailToLoginUrl('http://monkey.localhost:3000/login?redirect=%2F', 'a@b.co'))
      .toBe('http://monkey.localhost:3000/login?redirect=%2F&email=a%40b.co')
  })
})
