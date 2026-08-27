import { describe, expect, it } from 'vitest'
import { pageHasHtmlSnapshot, pageHasRenderedHtml } from '../../../server/utils/pageSnapshotHtml'

describe('pageHasRenderedHtml', () => {
  it('is true only when the freeze-frame file is present', () => {
    expect(pageHasRenderedHtml({ rendered_html: 'snapshot.html' })).toBe(true)
    expect(pageHasRenderedHtml({ rendered_html: ['snapshot.html'] })).toBe(true)
    expect(pageHasRenderedHtml({ rendered_html: '' })).toBe(false)
    expect(pageHasRenderedHtml({})).toBe(false)
  })

  it('does not treat truncated html_snapshot as a preview freeze-frame', () => {
    expect(pageHasRenderedHtml({
      rendered_html: '',
      html_snapshot: '<html><body><p>Hi</p></body></html>'
    } as { rendered_html?: unknown })).toBe(false)
  })
})

describe('pageHasHtmlSnapshot', () => {
  it('still detects truncated text snapshots for search/indexing', () => {
    expect(pageHasHtmlSnapshot({ html_snapshot: '<p>Hi</p>' })).toBe(true)
    expect(pageHasHtmlSnapshot({ html_size_bytes: 12 })).toBe(true)
    expect(pageHasHtmlSnapshot({})).toBe(false)
  })
})
