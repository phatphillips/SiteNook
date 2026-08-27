import { describe, expect, it } from 'vitest'
import { isValidCssSelector, looksLikeRegexPattern } from '../../../src/qa/cssSelector.js'

describe('isValidCssSelector', () => {
  it('accepts type, attribute, and compound selectors', () => {
    expect(isValidCssSelector('iframe')).toBe(true)
    expect(isValidCssSelector('iframe[src*="youtube.com"]')).toBe(true)
    expect(isValidCssSelector('.cookie-banner, #onetrust')).toBe(true)
  })

  it('rejects regex leftovers and empty input', () => {
    expect(isValidCssSelector('<iframe\\b')).toBe(false)
    expect(isValidCssSelector('<iframe')).toBe(false)
    expect(isValidCssSelector('')).toBe(false)
    expect(isValidCssSelector('  ')).toBe(false)
  })
})

describe('looksLikeRegexPattern', () => {
  it('detects html-tag regex leftovers', () => {
    expect(looksLikeRegexPattern('<iframe\\b')).toBe(true)
    expect(looksLikeRegexPattern('iframe')).toBe(false)
  })
})
