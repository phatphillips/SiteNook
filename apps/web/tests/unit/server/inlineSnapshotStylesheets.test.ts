import { describe, expect, it, vi } from 'vitest'
import {
  absolutizeCssUrls,
  inlineSnapshotStylesheets,
  stylesheetHrefFromLinkTag
} from '../../../server/utils/inlineSnapshotStylesheets'

describe('inlineSnapshotStylesheets', () => {
  it('reads stylesheet hrefs relative to the page URL', () => {
    expect(
      stylesheetHrefFromLinkTag(
        '<link rel="stylesheet" href="/wp-content/themes/astra/main.min.css">',
        'https://www.example.gov/about'
      )
    ).toBe('https://www.example.gov/wp-content/themes/astra/main.min.css')
  })

  it('inlines fetched CSS and leaves failed links in place', async () => {
    const fetchCss = vi.fn(async (href: string) => {
      if (href.endsWith('main.min.css')) return '.hero{background:#041e42}'
      return null
    })
    const html = [
      '<html><head>',
      '<link rel="stylesheet" href="https://example.gov/wp-content/themes/astra/main.min.css">',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Noto+Sans">',
      '</head><body><h1>Hi</h1></body></html>'
    ].join('')

    const out = await inlineSnapshotStylesheets(html, 'https://example.gov/about', fetchCss)
    expect(out).toContain('.hero{background:#041e42}')
    expect(out).toContain('data-accessiq-inlined="https://example.gov/wp-content/themes/astra/main.min.css"')
    expect(out).toContain('rel="stylesheet" href="https://example.gov/wp-content/themes/astra/main.min.css"')
    expect(out).toContain('fonts.googleapis.com/css?family=Noto+Sans')
  })

  it('does not refetch stylesheets already inlined at crawl time', async () => {
    const fetchCss = vi.fn(async () => '.should-not-run{}')
    const html = [
      '<html><head>',
      '<style data-accessiq-inlined="https://example.gov/theme.css">.hero{background:#041e42}</style>',
      '<link rel="stylesheet" href="https://example.gov/theme.css">',
      '</head><body><h1>Hi</h1></body></html>'
    ].join('')

    const out = await inlineSnapshotStylesheets(html, 'https://example.gov/about', fetchCss)
    expect(fetchCss).not.toHaveBeenCalled()
    expect(out).toContain('data-accessiq-inlined="https://example.gov/theme.css"')
  })

  it('restores wp-custom-css even when color variables already survived truncation', async () => {
    const { restoreMissingThemeStyles } = await import('../../../server/utils/inlineSnapshotStylesheets')
    const snapshot = [
      '<html class="ast-desktop"><head>',
      '<style>:root{--ast-global-color-0:#060097}</style>',
      '</head><body><div class="wp-block-group grid-background"><h1>Every School Day Matters.</h1></div></body></html>'
    ].join('')
    const live = [
      '<style id="wp-custom-css">.grid-background{background:#111c45}</style>',
      '<style id="global-styles-inline-css">:root{--wp--preset--spacing--30:12px}</style>',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat&display=swap">'
    ].join('')

    const out = await restoreMissingThemeStyles(snapshot, 'https://example.gov/', async () => live)
    expect(out).toContain('.grid-background{background:#111c45}')
    expect(out).toContain('--wp--preset--spacing--30:12px')
    expect(out).toContain('family=Caveat')
  })

  it('restores truncated WordPress theme style tags from the live HTML', async () => {
    const { restoreMissingThemeStyles } = await import('../../../server/utils/inlineSnapshotStylesheets')
    const snapshot = [
      '<html><head>',
      '<style>/* trimmed for snapshot storage */</style>',
      '</head><body><h1>Hi</h1></body></html>'
    ].join('')
    const live = [
      '<style id="astra-theme-css-inline-css">:root{--ast-global-color-0:#041e42}</style>',
      '<style id="global-styles-inline-css">body{background:navy}</style>'
    ].join('')

    const out = await restoreMissingThemeStyles(snapshot, 'https://example.gov/', async () => live)
    expect(out).toContain('--ast-global-color-0:#041e42')
    expect(out).toContain('id="global-styles-inline-css"')
    expect(out).not.toContain('trimmed for snapshot storage')
  })
})

describe('absolutizeCssUrls', () => {
  it('resolves relative url() values', () => {
    expect(
      absolutizeCssUrls(
        'body{background:url("../img/bg.png")}',
        'https://example.gov/theme/style.css'
      )
    ).toBe('body{background:url("https://example.gov/img/bg.png")}')
  })
})
