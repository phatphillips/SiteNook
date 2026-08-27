import { describe, expect, it } from 'vitest'
import {
  invalidCssSelectors,
  isValidCssSelector,
  looksLikeRegexPattern,
  parseCssExcludeSelectors
} from '~/utils/cssSelector'

describe('cssSelector helpers', () => {
  it('parses and validates exclude selectors', () => {
    expect(parseCssExcludeSelectors('iframe\n<iframe\\b')).toEqual(['iframe', '<iframe\\b'])
    expect(isValidCssSelector('iframe')).toBe(true)
    expect(isValidCssSelector('<iframe\\b')).toBe(false)
    expect(invalidCssSelectors('iframe\n<iframe\\b')).toEqual(['<iframe\\b'])
    expect(looksLikeRegexPattern('<iframe\\b')).toBe(true)
  })
})
