import { describe, expect, it } from 'vitest'
import {
  formatOrganizationUrl,
  parseSelfServiceSignupFlag
} from '~/utils/selfServiceSignup'

describe('parseSelfServiceSignupFlag', () => {
  it('accepts common truthy strings', () => {
    expect(parseSelfServiceSignupFlag('true')).toBe(true)
    expect(parseSelfServiceSignupFlag('1')).toBe(true)
    expect(parseSelfServiceSignupFlag('yes')).toBe(true)
    expect(parseSelfServiceSignupFlag(true)).toBe(true)
  })

  it('rejects falsey values', () => {
    expect(parseSelfServiceSignupFlag('false')).toBe(false)
    expect(parseSelfServiceSignupFlag('')).toBe(false)
    expect(parseSelfServiceSignupFlag(undefined)).toBe(false)
  })
})

describe('formatOrganizationUrl', () => {
  it('builds localhost tenant URLs with port', () => {
    expect(formatOrganizationUrl('acme', 'localhost', 'http://localhost:3000'))
      .toBe('http://acme.localhost:3000')
  })

  it('builds production tenant URLs', () => {
    expect(formatOrganizationUrl('acme', 'sitenook.com', 'https://sitenook.com'))
      .toBe('https://acme.sitenook.com')
  })
})
