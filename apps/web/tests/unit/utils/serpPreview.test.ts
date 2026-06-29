import { describe, expect, it } from 'vitest'
import {
  formatSerpDate,
  isOverSerpLimit,
  serpDescriptionPreview,
  serpTitlePreview,
  truncateSerpText
} from '~/utils/serpPreview'

describe('serpPreview', () => {
  it('truncates long titles at word boundary', () => {
    const title = 'This is how the Page Title appears in search results but if it is too long it gets cut'
    const preview = serpTitlePreview(title, 'mobile')
    expect(preview.length).toBeLessThanOrEqual(61)
    expect(preview.endsWith('…')).toBe(true)
  })

  it('leaves short titles unchanged', () => {
    expect(serpTitlePreview('Short title', 'mobile')).toBe('Short title')
  })

  it('prepends date to description when requested', () => {
    const desc = serpDescriptionPreview('Page description text here.', 'mobile', {
      includeDate: true,
      dateLabel: 'Jun 17, 2026'
    })
    expect(desc.startsWith('Jun 17, 2026')).toBe(true)
  })

  it('detects over-limit text', () => {
    expect(isOverSerpLimit('x'.repeat(200), 157)).toBe(true)
    expect(isOverSerpLimit('short', 157)).toBe(false)
  })

  it('formats valid dates', () => {
    expect(formatSerpDate('2026-06-17T12:00:00Z')).toMatch(/Jun/)
  })

  it('truncateSerpText handles empty input', () => {
    expect(truncateSerpText('', 60)).toBe('')
  })
})
