import { describe, expect, it } from 'vitest'
import {
  isAnonymousMarketingPath,
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
  it('allows apex marketing paths only when marketing site is enabled', () => {
    expect(isAnonymousMarketingPath('/', true)).toBe(true)
    expect(isAnonymousMarketingPath('/pricing', 'true')).toBe(true)
    expect(isAnonymousMarketingPath('/blog/accessibility-score-trends', true)).toBe(true)
    expect(isAnonymousMarketingPath('/help/getting-started/first-scan', true)).toBe(true)
    expect(isAnonymousMarketingPath('/', false)).toBe(false)
    expect(isAnonymousMarketingPath('/sites', true)).toBe(false)
  })
})
