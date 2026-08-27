import { describe, expect, it } from 'vitest'
import {
  checkAiBotStatus,
  isDisallowedByRobots,
  isPathDisallowedForAgent,
  parseRobotsTxt,
  pathMatchesRule
} from '../../../src/crawler/robots.js'

/** Same filtering as loadRobotsDisallows (wildcard * groups only). */
function disallowsForWildcardAgent(text: string): string[] {
  const parsed = parseRobotsTxt(text)
  const paths: string[] = []
  for (const group of parsed.groups) {
    if (!group.agents.includes('*')) continue
    for (const rule of group.rules) {
      if (rule.type === 'disallow' && rule.path) paths.push(rule.path)
    }
  }
  return paths
}

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

describe('pathMatchesRule', () => {
  it('matches Drupal-style trailing wildcards', () => {
    expect(pathMatchesRule('/user/login', '/user/*')).toBe(true)
    expect(pathMatchesRule('/about', '/user/*')).toBe(false)
    expect(pathMatchesRule('/', '/')).toBe(true)
  })
})

describe('isDisallowedByRobots / wildcard-only disallows', () => {
  it('does not apply bot-specific Disallow: / to the scanner (GovCMS-style)', () => {
    const govcmsLike = `
User-agent: *
Disallow: /core/
Disallow: /admin/*
Disallow: /user/*

User-agent: DeepSeekBot
Disallow: /
User-agent: DeepSeek
Disallow: /
`
    const disallows = disallowsForWildcardAgent(govcmsLike)
    expect(disallows).not.toContain('/')
    expect(isDisallowedByRobots('https://www.govcms.gov.au/', disallows)).toBe(false)
    expect(isDisallowedByRobots('https://www.govcms.gov.au/user/login', disallows)).toBe(true)
    expect(isDisallowedByRobots('https://www.govcms.gov.au/about', disallows)).toBe(false)
  })
})
