import { describe, expect, it } from 'vitest'
import {
  isMarketingApexPath,
  parseMarketingSiteFlag
} from '~/utils/marketingSite'

describe('parseMarketingSiteFlag', () => {
  it('accepts common truthy strings', () => {
    expect(parseMarketingSiteFlag('true')).toBe(true)
    expect(parseMarketingSiteFlag('1')).toBe(true)
    expect(parseMarketingSiteFlag(true)).toBe(true)
  })

  it('rejects falsey values', () => {
    expect(parseMarketingSiteFlag('false')).toBe(false)
    expect(parseMarketingSiteFlag('')).toBe(false)
  })
})

describe('isMarketingApexPath', () => {
  it('includes landing and pricing paths', () => {
    expect(isMarketingApexPath('/')).toBe(true)
    expect(isMarketingApexPath('/pricing')).toBe(true)
    expect(isMarketingApexPath('/login')).toBe(false)
  })
})
