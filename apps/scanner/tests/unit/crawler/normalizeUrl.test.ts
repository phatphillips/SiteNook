import { describe, expect, it } from 'vitest'
import { normalizeUrl, rewriteSameSiteLink } from '../../../src/crawler/siteCrawler.js'

describe('normalizeUrl', () => {
  it('strips hash and trailing slash except root', () => {
    expect(normalizeUrl('https://example.com/about/#section')).toBe('https://example.com/about')
    expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about')
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
  })
})

describe('rewriteSameSiteLink', () => {
  it('rewrites apex homepage links onto the www start origin', () => {
    expect(rewriteSameSiteLink(
      'https://example.com/',
      'https://www.example.com',
      true
    )).toBe('https://www.example.com/')
  })

  it('keeps in-origin paths and drops other hosts', () => {
    expect(rewriteSameSiteLink(
      'https://www.example.com/about',
      'https://www.example.com',
      true
    )).toBe('https://www.example.com/about')
    expect(rewriteSameSiteLink(
      'https://other.example/about',
      'https://www.example.com',
      true
    )).toBeNull()
  })
})
