import { describe, it, expect } from 'vitest'
import {
  isHttpUrl,
  optionalHttpUrl,
  sanitizeAxeIssue,
  sanitizeInventoryRecord
} from '../../../src/db/recordSanitize.js'

describe('recordSanitize', () => {
  it('optionalHttpUrl rejects empty and non-http URLs', () => {
    expect(optionalHttpUrl('')).toBeUndefined()
    expect(optionalHttpUrl('javascript:void(0)')).toBeUndefined()
    expect(optionalHttpUrl('https://dequeuniversity.com/rules/axe/4.10/color-contrast')).toBe(
      'https://dequeuniversity.com/rules/axe/4.10/color-contrast'
    )
  })

  it('sanitizeAxeIssue omits invalid help_url and normalizes impact', () => {
    const issue = sanitizeAxeIssue({
      rule_id: 'color-contrast',
      impact: 'bogus',
      help_url: '',
      status: 'open'
    })

    expect(issue.help_url).toBeUndefined()
    expect(issue.impact).toBe('moderate')
  })

  it('sanitizeInventoryRecord drops non-http asset URLs', () => {
    expect(sanitizeInventoryRecord({
      url: 'mailto:test@example.com',
      content_type: 'asset',
      mime_type: 'unknown',
      is_pdf: false,
      size_bytes: 0
    })).toBeNull()

    expect(sanitizeInventoryRecord({
      url: 'https://example.com/file.pdf',
      content_type: 'pdf',
      mime_type: 'application/pdf',
      is_pdf: true,
      size_bytes: 0
    })?.url).toBe('https://example.com/file.pdf')
  })

  it('isHttpUrl accepts http and https only', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
    expect(isHttpUrl('http://example.com/path')).toBe(true)
    expect(isHttpUrl('ftp://example.com')).toBe(false)
  })
})
