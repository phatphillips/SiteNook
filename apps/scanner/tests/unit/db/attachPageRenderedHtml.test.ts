import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  RENDERED_HTML_MAX_BYTES,
  attachPageRenderedHtml,
  renderedHtmlBufferFromSnapshot
} from '../../../src/db/attachPageRenderedHtml.js'

describe('renderedHtmlBufferFromSnapshot', () => {
  it('returns a utf8 buffer for typical page HTML', () => {
    const buf = renderedHtmlBufferFromSnapshot('<html><body>Hi</body></html>')
    expect(buf?.toString('utf8')).toContain('Hi')
  })

  it('skips empty HTML', () => {
    expect(renderedHtmlBufferFromSnapshot('')).toBeUndefined()
  })

  it('skips HTML over the 8MB file cap', () => {
    const huge = 'x'.repeat(RENDERED_HTML_MAX_BYTES + 1)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(renderedHtmlBufferFromSnapshot(huge)).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('attachPageRenderedHtml', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call PocketBase when the buffer is empty', async () => {
    const update = vi.fn()
    const pb = { collection: vi.fn(() => ({ update })) }
    await attachPageRenderedHtml(pb as never, 'page-1', Buffer.alloc(0))
    expect(update).not.toHaveBeenCalled()
  })

  it('does not upload when the buffer exceeds the file cap', async () => {
    const update = vi.fn()
    const pb = { collection: vi.fn(() => ({ update })) }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await attachPageRenderedHtml(
      pb as never,
      'page-1',
      Buffer.alloc(RENDERED_HTML_MAX_BYTES + 1)
    )
    expect(update).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('uploads snapshot.html on a valid buffer', async () => {
    const update = vi.fn(async () => ({ id: 'page-1' }))
    const pb = { collection: vi.fn(() => ({ update })) }
    await attachPageRenderedHtml(
      pb as never,
      'page-1',
      Buffer.from('<html><body>Hi</body></html>', 'utf8')
    )
    expect(pb.collection).toHaveBeenCalledWith('pages')
    expect(update).toHaveBeenCalledTimes(1)
    const form = update.mock.calls[0]?.[1] as FormData
    expect(form).toBeInstanceOf(FormData)
    const file = form.get('rendered_html')
    expect(file).toBeTruthy()
  })
})
