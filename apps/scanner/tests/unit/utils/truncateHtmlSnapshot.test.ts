import { describe, expect, it } from 'vitest'
import { truncateHtmlSnapshot } from '../../../src/utils/truncateHtmlSnapshot.js'

describe('truncateHtmlSnapshot', () => {
  it('keeps short HTML unchanged', () => {
    const html = '<!DOCTYPE html><html><head></head><body><p>Hi</p></body></html>'
    expect(truncateHtmlSnapshot(html, 1000)).toBe(html)
  })

  it('preserves body when head alone exceeds the budget', () => {
    const hugeStyle = 'x'.repeat(50_000)
    const html = `<!DOCTYPE html><html><head><style>${hugeStyle}</style><style>${hugeStyle}</style></head><body><h1>Visible title</h1><p>Hello world content</p></body></html>`
    const out = truncateHtmlSnapshot(html, 20_000)
    expect(out.length).toBeLessThanOrEqual(20_000)
    expect(out).toMatch(/<body/i)
    expect(out).toContain('Visible title')
    expect(out).toContain('Hello world content')
  })

  it('keeps complete style tags and later body content when both fit', () => {
    const pad = 'n'.repeat(180)
    const html = `<!DOCTYPE html><html><head><style>.hero{color:gold}</style><title>${pad}</title></head><body><h1>Every School Day Matters.</h1><header>${pad}</header></body></html>`
    const out = truncateHtmlSnapshot(html, 420)
    expect(out.length).toBeLessThanOrEqual(420)
    expect(out).toContain('.hero{color:gold}')
    expect(out).toContain('Every School Day Matters.')
  })
})
