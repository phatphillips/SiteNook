import { describe, expect, it } from 'vitest'
import { checkLlmsTxt } from '../../../src/seo/llmsChecker.js'

describe('checkLlmsTxt', () => {
  it('validates markdown with summary and links', () => {
    const valid = '# Site\n\nThis is a summary of our website with enough text.\n\n- [Home](https://example.com/)'
    const linkCount = (valid.match(/\[([^\]]+)\]\(([^)]+)\)/g) ?? []).length
    const lines = valid.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const proseLines = lines.filter(l => !l.startsWith('#') && !l.startsWith('-'))
    const hasSummary = proseLines.some(l => l.length >= 20) || lines.some(l => l.startsWith('#'))
    expect(hasSummary).toBe(true)
    expect(linkCount).toBeGreaterThanOrEqual(1)
  })
})
