import { describe, expect, it } from 'vitest'
import {
  HELP_CATEGORIES,
  helpCategoryLabel,
  helpPathFromParts,
  isHelpCategoryId,
  parseHelpSlugParam
} from '~/utils/help'

describe('help utils', () => {
  it('exposes five Cursor-style categories', () => {
    expect(HELP_CATEGORIES.map(c => c.id)).toEqual([
      'getting-started',
      'scanning',
      'accessibility',
      'account-billing',
      'troubleshooting'
    ])
  })

  it('builds article paths and labels', () => {
    expect(helpPathFromParts('getting-started', 'first-scan')).toBe(
      '/help/getting-started/first-scan'
    )
    expect(helpCategoryLabel('scanning')).toBe('Scanning')
    expect(helpCategoryLabel('unknown')).toBe('unknown')
    expect(isHelpCategoryId('accessibility')).toBe(true)
    expect(isHelpCategoryId('nope')).toBe(false)
  })

  it('parses category and article slug params', () => {
    expect(parseHelpSlugParam('getting-started')).toEqual({
      category: 'getting-started',
      slug: '',
      pathKey: 'getting-started'
    })
    expect(parseHelpSlugParam('getting-started/first-scan')).toEqual({
      category: 'getting-started',
      slug: 'first-scan',
      pathKey: 'getting-started/first-scan'
    })
    expect(parseHelpSlugParam(['scanning', 'cancel-a-scan'])).toEqual({
      category: 'scanning',
      slug: 'cancel-a-scan',
      pathKey: 'scanning/cancel-a-scan'
    })
    expect(parseHelpSlugParam('')).toBeNull()
    expect(parseHelpSlugParam('not-a-category')).toBeNull()
  })
})
