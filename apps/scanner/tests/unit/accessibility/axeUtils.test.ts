import { describe, it, expect } from 'vitest'
import { DEFAULT_AXE_TAGS } from '../../../src/accessibility/axeRunner.js'

describe('DEFAULT_AXE_TAGS', () => {
  it('includes WCAG 2.2 and best-practice tags for full inventory scans', () => {
    expect(DEFAULT_AXE_TAGS).toContain('wcag22a')
    expect(DEFAULT_AXE_TAGS).toContain('wcag22aa')
    expect(DEFAULT_AXE_TAGS).toContain('wcag22aaa')
    expect(DEFAULT_AXE_TAGS).toContain('best-practice')
  })
})
