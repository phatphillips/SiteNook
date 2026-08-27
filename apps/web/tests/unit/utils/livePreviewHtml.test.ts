import { describe, expect, it } from 'vitest'
import { prepareLivePreviewHtml, previewBaseHref, livePageUrlCandidates, canonicalUrlFromHtml } from '~/utils/livePreviewHtml'

describe('prepareLivePreviewHtml', () => {
  it('injects base href and keeps scripts', () => {
    const html = prepareLivePreviewHtml(
      '<html><head></head><body><p>Hi</p><script>window.ready=true</script></body></html>',
      'https://example.gov/page'
    )
    expect(html).toContain('<base href="https://example.gov/page/">')
    expect(html).toContain('<script>window.ready=true</script>')
    expect(html).toContain('data-accessiq-preview')
    expect(html).toContain('localStorage')
    expect(html).toContain('sessionStorage')
    expect(html).not.toContain('data-accessiq-freeze')
    expect(html).toContain('data-accessiq-astra-header')
    expect(html).not.toContain('ast-header-loaded')
    expect(html).not.toContain('class="ast-desktop"')
  })

  it('replaces existing base tags and strips framing CSP meta', () => {
    const html = prepareLivePreviewHtml(
      [
        '<html><head>',
        '<base href="https://old.example/">',
        '<meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'">',
        '<meta http-equiv="X-Frame-Options" content="DENY">',
        '</head><body>Ok</body></html>'
      ].join(''),
      'https://example.gov/'
    )
    expect(html).toContain('<base href="https://example.gov/">')
    expect(html).not.toContain('https://old.example/')
    expect(html).not.toContain('Content-Security-Policy')
    expect(html).not.toContain('X-Frame-Options')
    expect(html).toContain('Ok')
  })

  it('keeps stylesheet links so the iframe can load live CSS', () => {
    const html = prepareLivePreviewHtml(
      '<html><head><link rel="stylesheet" href="/theme.css"></head><body>Ok</body></html>',
      'https://example.gov/'
    )
    expect(html).toContain('href="/theme.css"')
    expect(html).not.toContain('referrerpolicy="no-referrer"')
  })

  it('strips analytics trackers from preview HTML', () => {
    const html = prepareLivePreviewHtml(
      '<html><head></head><body><script src="https://siteimproveanalytics.com/js/siteanalyze_1.js"></script><p>Hi</p></body></html>',
      'https://example.gov/'
    )
    expect(html).toContain('Hi')
    expect(html).not.toContain('siteanalyze')
  })

  it('adds a trailing slash to permalink base hrefs', () => {
    expect(previewBaseHref('https://example.gov/vet')).toBe('https://example.gov/vet/')
    expect(previewBaseHref('https://example.gov/vet/')).toBe('https://example.gov/vet/')
    expect(previewBaseHref('https://example.gov/file.css')).toBe('https://example.gov/file.css')
  })

  it('builds slash and www URL candidates', () => {
    const urls = livePageUrlCandidates(
      'https://anything.tas.gov.au/for-students/vocational-education'
    )
    expect(urls[0]).toBe('https://anything.tas.gov.au/for-students/vocational-education')
    expect(urls).toContain('https://anything.tas.gov.au/for-students/vocational-education/')
    expect(urls).toContain('https://www.anything.tas.gov.au/for-students/vocational-education/')
  })

  it('reads a canonical URL from crawl HTML', () => {
    expect(canonicalUrlFromHtml(
      '<link rel="canonical" href="https://example.gov/vet/">',
      'https://example.gov/old-vet'
    )).toBe('https://example.gov/vet/')
  })
})
