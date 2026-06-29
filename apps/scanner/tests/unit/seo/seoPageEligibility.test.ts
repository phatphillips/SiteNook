import { describe, expect, it } from 'vitest'
import { isCanonicalSeoPageUrl } from '../../../src/seo/seoPageEligibility.js'
import { normalizeSeoUrl } from '../../../src/seo/linkGraph.js'

describe('isCanonicalSeoPageUrl', () => {
  it('rejects URLs with query strings', () => {
    expect(isCanonicalSeoPageUrl('https://garrit.xyz/posts?tags=aws')).toBe(false)
    expect(isCanonicalSeoPageUrl('https://example.com/page?page=2')).toBe(false)
  })

  it('rejects static asset paths', () => {
    expect(isCanonicalSeoPageUrl('https://garrit.xyz/rss.xml')).toBe(false)
    expect(isCanonicalSeoPageUrl('https://garrit.xyz/beats/001-hello/hello.mp3')).toBe(false)
  })

  it('accepts normal HTML paths', () => {
    expect(isCanonicalSeoPageUrl('https://garrit.xyz/journal')).toBe(true)
    expect(isCanonicalSeoPageUrl('https://garrit.xyz/posts/2023-02-21-hello')).toBe(true)
  })
})

describe('normalizeSeoUrl', () => {
  it('maps /index to site root', () => {
    expect(normalizeSeoUrl('https://garrit.xyz/index')).toBe('https://garrit.xyz/')
  })
})
