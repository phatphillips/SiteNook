import { describe, expect, it } from 'vitest'
import {
  htmlSnapshotHasBody,
  prepareSimulatorPreviewHtml,
  prepareSnapshotPreviewHtml,
  stripScriptsAndHandlers,
  truncateHtmlSnapshot
} from '~/utils/simulatorHtml'

describe('simulatorHtml', () => {
  it('detects missing body in head-only truncated snapshots', () => {
    const headOnly = `<!DOCTYPE html><html><head><style>${'x'.repeat(1000)}</style></head>`
    expect(htmlSnapshotHasBody(headOnly)).toBe(false)
    expect(htmlSnapshotHasBody('<html><body><p>Hi</p></body></html>')).toBe(true)
  })

  it('preserves body when truncating head-heavy HTML', () => {
    const html = `<!DOCTYPE html><html><head><style>${'y'.repeat(40_000)}</style></head><body><main><h1>Page</h1><p>Content here</p></main></body></html>`
    const out = truncateHtmlSnapshot(html, 15_000)
    expect(out).toContain('Content here')
    expect(htmlSnapshotHasBody(out)).toBe(true)
  })

  it('prepares srcdoc with base href and strips scripts', () => {
    const html = prepareSimulatorPreviewHtml(
      '<html><head></head><body><p>Hi</p><script>alert(1)</script></body></html>',
      'https://example.com/page'
    )
    expect(html).toContain('<base target="_blank" href="https://example.com/page">')
    expect(html).toContain('Hi')
    expect(html).not.toContain('<script>')
  })

  it('prepares snapshot HTML without truncating and strips javascript URLs', () => {
    const html = prepareSnapshotPreviewHtml(
      '<html><head></head><body><a href="javascript:alert(1)">x</a><p onclick="evil()">Hi</p></body></html>',
      'https://example.gov/page'
    )
    expect(html).toContain('<base target="_blank" href="https://example.gov/page">')
    expect(html).toContain('Hi')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('data-simulator-preview')
    expect(html).toContain('ast-desktop')
    expect(html).toContain('ast-header-loaded')
    expect(html).toContain('data-accessiq-freeze')
    expect(html).toContain('Material Symbols Outlined')
  })

  it('does not inject live WordPress/Astra stylesheet links into the freeze-frame', () => {
    const html = prepareSnapshotPreviewHtml(
      '<html class="wp-theme-astra"><head></head><body class="ast-desktop"><span class="material-symbols-outlined">star_shine</span><div class="wp-block-group">Hero</div></body></html>',
      'https://anything.tas.gov.au/'
    )
    expect(html).not.toContain('wp-content/themes/astra/assets/css/minified/main.min.css')
    expect(html).not.toContain('wp-includes/css/dist/block-library/style.min.css')
    expect(html).toContain('data-accessiq-freeze')
    expect(html).toContain('Hero')
  })

  it('replaces YouTube iframes with a poster and leaves other iframes', () => {
    const html = prepareSnapshotPreviewHtml(
      '<html><head></head><body>'
      + '<iframe title="Every School Day Matters" src="https://www.youtube.com/embed/FVLRFAVyvRU?feature=oembed"></iframe>'
      + '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-X"></iframe>'
      + '</body></html>',
      'https://example.gov/'
    )
    expect(html).toContain('data-accessiq-embed-poster')
    expect(html).toContain('https://i.ytimg.com/vi/FVLRFAVyvRU/hqdefault.jpg')
    expect(html).not.toContain('youtube.com/embed')
    expect(html).toContain('googletagmanager.com')
  })

  it('unhides Astra mobile header chrome when the desktop wrap is empty', () => {
    const html = prepareSnapshotPreviewHtml(
      '<html class="ast-desktop ast-header-loaded"><head></head><body>'
      + '<header id="masthead"><div id="ast-desktop-header"></div>'
      + '<div id="ast-mobile-header"><a class="site-logo" href="/"><img alt="Logo" src="logo.svg"></a></div></header>'
      + '</body></html>',
      'https://example.gov/'
    )
    expect(html).toContain('#ast-mobile-header')
    expect(html).toContain('#ast-desktop-header:not(:has(img))')
    expect(html).toContain('#ast-desktop-header:has(.main-header-menu-toggle)')
    expect(html).toContain('display: none !important')
    expect(html).toContain('display: block !important')
    expect(html).toContain('iframe[src*="youtube.com"]')
  })

  it('does not add a live stylesheet link when CSS was already inlined at crawl time', () => {
    const html = prepareSnapshotPreviewHtml(
      '<html class="ast-desktop"><head><style data-accessiq-inlined="https://anything.tas.gov.au/wp-content/themes/astra/assets/css/minified/main.min.css">.x{}</style></head><body><span class="material-symbols-outlined">star</span></body></html>',
      'https://anything.tas.gov.au/'
    )
    expect(html).not.toContain('<link rel="stylesheet" href="https://anything.tas.gov.au/wp-content/themes/astra/assets/css/minified/main.min.css">')
    expect(html).toContain('data-accessiq-inlined')
  })

  it('strips script tags and javascript hrefs', () => {
    const out = stripScriptsAndHandlers(
      '<p><a href="javascript:void(0)">go</a><script>alert(1)</script></p>'
    )
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('javascript:')
  })

  it('strips scripts in linear time even when a tag is unclosed', () => {
    const html = `<html><body><p>Hi</p><script>${'x'.repeat(200_000)}`
    const started = Date.now()
    const out = stripScriptsAndHandlers(html)
    expect(Date.now() - started).toBeLessThan(500)
    expect(out).toContain('<p>Hi</p>')
    expect(out).not.toContain('<script>')
  })

  it('closes a truncated style tag so the body still parses', () => {
    const html = '<html><head><style>.hero{color:gold}'
      + '<body><header class="site-header"><h1>Every School Day Matters.</h1></header></body></html>'
    const out = prepareSnapshotPreviewHtml(html, 'https://example.gov/')
    expect(out).toContain('</style>')
    expect(out).toContain('Every School Day Matters.')
  })

  it('does not let a truncated noscript iframe eat the rest of the page', () => {
    const html = [
      '<html><body>',
      '<!-- Google Tag Manager (noscript) -->',
      '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-X"',
      '<header class="site-header"><h1>Every School Day Matters.</h1></header>',
      '<p>Feeling inspired?</p>',
      '</noscript>',
      '</body></html>'
    ].join('')
    const out = stripScriptsAndHandlers(html)
    expect(out).toContain('Every School Day Matters.')
    expect(out).toContain('Feeling inspired?')
    expect(out).not.toContain('googletagmanager')
  })

  it('does not let a truncated script eat the rest of the page', () => {
    const html = [
      '<html><body>',
      '<script data-cfasync="false">(function(){var mq=window.matchMedia("(max-width:921px)"',
      '<header class="site-header"><h1>Every School Day Matters.</h1></header>',
      '<script>console.log(1)</script>',
      '<footer>Acknowledgement</footer>',
      '</body></html>'
    ].join('')
    const out = stripScriptsAndHandlers(html)
    expect(out).toContain('Every School Day Matters.')
    expect(out).toContain('Acknowledgement')
    expect(out).not.toContain('<script>')
  })
})
