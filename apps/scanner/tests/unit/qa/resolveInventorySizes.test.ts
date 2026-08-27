import { describe, expect, it } from 'vitest'
import {
  parseContentLength,
  parseTotalFromContentRange
} from '../../../src/qa/resolveInventorySizes.js'

describe('resolveInventorySizes', () => {
  it('parseContentLength accepts positive numbers only', () => {
    expect(parseContentLength('1234')).toBe(1234)
    expect(parseContentLength('0')).toBe(0)
    expect(parseContentLength(null)).toBe(0)
  })

  it('parseTotalFromContentRange reads total bytes', () => {
    expect(parseTotalFromContentRange('bytes 0-0/98765')).toBe(98765)
    expect(parseTotalFromContentRange('invalid')).toBe(0)
  })
})
