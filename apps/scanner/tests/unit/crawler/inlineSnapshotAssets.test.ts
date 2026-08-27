import { describe, expect, it } from 'vitest'
import {
  collectSnapshotAssetUrls,
  dataUriFromAsset,
  inlineFetchedAssets,
  mimeTypeForAsset,
  replaceHtmlAssetUrls,
  shouldInlineSnapshotAsset
} from '../../../src/crawler/inlineSnapshotAssets.js'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('shouldInlineSnapshotAsset', () => {
  it('accepts http(s) images and fonts', () => {
    expect(shouldInlineSnapshotAsset('https://cdn.example/hero.png')).toBe(true)
    expect(shouldInlineSnapshotAsset('https://fonts.gstatic.com/s/notosans/v42/a.woff2')).toBe(true)
    expect(shouldInlineSnapshotAsset('//cdn.example/a.svg')).toBe(true)
  })

  it('skips data, hash, javascript, and tracking pixels', () => {
    expect(shouldInlineSnapshotAsset('data:image/png;base64,xx')).toBe(false)
    expect(shouldInlineSnapshotAsset('#icon')).toBe(false)
    expect(shouldInlineSnapshotAsset('javascript:void(0)')).toBe(false)
    expect(shouldInlineSnapshotAsset('https://www.facebook.com/tr?id=1&ev=PageView')).toBe(false)
    expect(shouldInlineSnapshotAsset('https://www.google-analytics.com/g/collect')).toBe(false)
  })
})

describe('collectSnapshotAssetUrls', () => {
  it('collects img src and CSS url() values', () => {
    const html = `
      <html><head><style>.hero{background-image:url("https://cdn.example/bg.png")}</style></head>
      <body>
        <img src="https://cdn.example/hero.jpg">
        <img src="https://www.facebook.com/tr?id=1">
        <video poster="https://cdn.example/poster.jpg" src="https://cdn.example/clip.mp4"></video>
      </body></html>
    `
    const urls = collectSnapshotAssetUrls(html)
    expect(urls).toContain('https://cdn.example/bg.png')
    expect(urls).toContain('https://cdn.example/hero.jpg')
    expect(urls).toContain('https://cdn.example/poster.jpg')
    expect(urls).not.toContain('https://cdn.example/clip.mp4')
    expect(urls.some(url => url.includes('facebook.com'))).toBe(false)
  })
})

describe('mimeTypeForAsset', () => {
  it('prefers the response content type', () => {
    expect(mimeTypeForAsset('image/webp; charset=binary', 'https://x/a.png')).toBe('image/webp')
  })

  it('falls back to the file extension', () => {
    expect(mimeTypeForAsset('application/octet-stream', 'https://fonts.gstatic.com/s/a.woff2')).toBe('font/woff2')
  })

  it('rejects HTML and CSS bodies', () => {
    expect(mimeTypeForAsset('text/html', 'https://example.com/hero.png')).toBeNull()
  })
})

describe('inlineFetchedAssets', () => {
  it('rewrites fetched images to data URIs and leaves skipped URLs', async () => {
    const html = `
      <html><body>
        <img src="https://cdn.example/hero.png">
        <img src="https://www.facebook.com/tr?id=1">
      </body></html>
    `
    const out = await inlineFetchedAssets(html, async (url) => {
      if (url.endsWith('hero.png')) return { bytes: PNG, contentType: 'image/png' }
      throw new Error(`unexpected fetch ${url}`)
    })
    expect(out).toContain('data:image/png;base64,')
    expect(out).not.toContain('https://cdn.example/hero.png')
    expect(out).toContain('https://www.facebook.com/tr?id=1')
  })

  it('skips assets over the per-file cap', async () => {
    const html = '<img src="https://cdn.example/huge.png">'
    const huge = Buffer.alloc(50)
    const out = await inlineFetchedAssets(html, async () => ({
      bytes: huge,
      contentType: 'image/png'
    }), { maxAssetBytes: 10 })
    expect(out).toContain('https://cdn.example/huge.png')
    expect(out).not.toContain('data:image/png')
  })

  it('charges each occurrence against the budget', async () => {
    const html = '<img src="https://cdn.example/a.png"><img src="https://cdn.example/a.png">'
    const out = await inlineFetchedAssets(html, async () => ({
      bytes: PNG,
      contentType: 'image/png'
    }), { budgetBytes: Buffer.byteLength(html, 'utf8') + 150 })
    expect(out).toContain('https://cdn.example/a.png')
    expect(out).not.toContain('data:image/png')
  })

  it('stops when the total budget would be exceeded', async () => {
    const html = '<img src="https://cdn.example/a.png"><img src="https://cdn.example/b.png">'
    const out = await inlineFetchedAssets(html, async () => ({
      bytes: PNG,
      contentType: 'image/png'
    }), { budgetBytes: Buffer.byteLength(html, 'utf8') + 200 })
    const inlined = (out.match(/data:image\/png;base64,/g) || []).length
    expect(inlined).toBe(1)
    expect(out.includes('https://cdn.example/a.png') || out.includes('https://cdn.example/b.png')).toBe(true)
  })
})

describe('replaceHtmlAssetUrls', () => {
  it('replaces the longest URL first', () => {
    const html = 'url(https://cdn.example/a.png) url(https://cdn.example/a.png?w=2)'
    const map = new Map([
      ['https://cdn.example/a.png', 'data:short'],
      ['https://cdn.example/a.png?w=2', 'data:long']
    ])
    expect(replaceHtmlAssetUrls(html, map)).toBe('url(data:short) url(data:long)')
  })
})

describe('dataUriFromAsset', () => {
  it('encodes bytes as a data URI', () => {
    expect(dataUriFromAsset(Buffer.from('hi'), 'text/plain')).toBe('data:text/plain;base64,aGk=')
  })
})
