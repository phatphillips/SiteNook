import { describe, it, expect } from 'vitest'
import {
  matchesExclude,
  matchesInclude,
  urlPathAndQuery
} from '../../../src/crawler/urlPatterns.js'

describe('urlPathAndQuery', () => {
  it('strips the origin and returns only path+query', () => {
    expect(urlPathAndQuery('https://example.com/about?x=1')).toBe('/about?x=1')
    expect(urlPathAndQuery('https://example.com/')).toBe('/')
  })
})

describe('matchesExclude', () => {
  it('returns true when URL matches an exclude pattern', () => {
    expect(matchesExclude('https://example.com/wp-admin/users', ['/wp-admin/*'])).toBe(true)
  })

  it('returns false when URL does not match any exclude pattern', () => {
    expect(matchesExclude('https://example.com/about', ['/wp-admin/*'])).toBe(false)
  })

  it('supports wildcard glob patterns', () => {
    expect(matchesExclude('https://example.com/cdn-cgi/trace', ['/cdn-cgi/*'])).toBe(true)
    expect(matchesExclude('https://example.com/cdn-cgi/nested/path', ['/cdn-cgi/**'])).toBe(true)
  })
})

describe('matchesInclude', () => {
  it('returns true for all URLs when include list is empty', () => {
    expect(matchesInclude('https://example.com/any', [])).toBe(true)
  })

  it('returns true when URL matches an include pattern', () => {
    expect(matchesInclude('https://example.com/docs/guide', ['/docs/*'])).toBe(true)
  })

  it('returns false when URL does not match include patterns', () => {
    expect(matchesInclude('https://example.com/private', ['/docs/*'])).toBe(false)
  })
})
