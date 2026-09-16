import { describe, expect, it } from 'vitest'
import {
  isAnonymousMarketingPath,
  isMarketingApexPath,
  isMarketingSiteActive,
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

describe('isMarketingSiteActive', () => {
  it('requires both marketing flag and commercial', () => {
    expect(isMarketingSiteActive(true, true)).toBe(true)
    expect(isMarketingSiteActive('true', '1')).toBe(true)
    expect(isMarketingSiteActive(true, false)).toBe(false)
    expect(isMarketingSiteActive(true, '0')).toBe(false)
    expect(isMarketingSiteActive(false, true)).toBe(false)
  })
})

describe('isMarketingApexPath', () => {
  it('includes landing, pricing, and public content paths', () => {
    expect(isMarketingApexPath('/')).toBe(true)
    expect(isMarketingApexPath('/pricing')).toBe(true)
    expect(isMarketingApexPath('/download')).toBe(true)
    expect(isMarketingApexPath('/blog')).toBe(true)
    expect(isMarketingApexPath('/blog/accessibility-score-trends')).toBe(true)
    expect(isMarketingApexPath('/docs')).toBe(true)
    expect(isMarketingApexPath('/help')).toBe(true)
    expect(isMarketingApexPath('/product/accessibility')).toBe(true)
    expect(isMarketingApexPath('/login')).toBe(false)
    expect(isMarketingApexPath('/sites')).toBe(false)
  })
})

describe('isAnonymousMarketingPath', () => {
  it('allows apex marketing paths only when marketing + commercial are enabled', () => {
    expect(isAnonymousMarketingPath('/', true, true)).toBe(true)
    expect(isAnonymousMarketingPath('/pricing', 'true', '1')).toBe(true)
    expect(isAnonymousMarketingPath('/blog/accessibility-score-trends', true, true)).toBe(true)
    expect(isAnonymousMarketingPath('/', true, false)).toBe(false)
    expect(isAnonymousMarketingPath('/', true, '0')).toBe(false)
    expect(isAnonymousMarketingPath('/', false, true)).toBe(false)
    expect(isAnonymousMarketingPath('/sites', true, true)).toBe(false)
  })
})
