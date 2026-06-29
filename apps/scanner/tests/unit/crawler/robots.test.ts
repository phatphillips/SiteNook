import { describe, expect, it } from 'vitest'
import {
  checkAiBotStatus,
  isPathDisallowedForAgent,
  parseRobotsTxt
} from '../../../src/crawler/robots.js'

describe('parseRobotsTxt', () => {
  it('extracts Sitemap directives', () => {
    const parsed = parseRobotsTxt(`
User-agent: *
Disallow: /private/

Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
`)
    expect(parsed.sitemapUrls).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/sitemap-news.xml'
    ])
  })

  it('groups rules by user-agent', () => {
    const parsed = parseRobotsTxt(`
User-agent: Googlebot
Disallow: /secret/

User-agent: *
Allow: /
Disallow: /admin/
`)
    expect(parsed.groups.length).toBeGreaterThanOrEqual(2)
    const google = parsed.groups.find(g => g.agents.includes('googlebot'))
    expect(google?.rules.some(r => r.type === 'disallow' && r.path === '/secret/')).toBe(true)
  })
})

describe('checkAiBotStatus', () => {
  it('detects blocked bots on root', () => {
    const parsed = parseRobotsTxt(`
User-agent: PerplexityBot
Disallow: /

User-agent: *
Allow: /
`)
    const status = checkAiBotStatus(parsed)
    expect(status.PerplexityBot).toBe('blocked')
    expect(status.Googlebot).toBe('allowed')
  })
})

describe('isPathDisallowedForAgent', () => {
  it('respects Allow over Disallow for specific agent', () => {
    const parsed = parseRobotsTxt(`
User-agent: *
Disallow: /
Allow: /public/
`)
    expect(isPathDisallowedForAgent('/public/page', 'Googlebot', parsed)).toBe(false)
    expect(isPathDisallowedForAgent('/private', 'Googlebot', parsed)).toBe(true)
  })
})
