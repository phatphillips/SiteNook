import { describe, it, expect } from 'vitest'
import {
  deriveScanTypeFromRaw,
  mergeRawScanConfigs,
  parseRawConfig
} from '../../../src/config/scanConfig.js'
import { getPostLoadDelay } from '../../../src/config/scanConfig.js'

describe('parseRawConfig', () => {
  it('parses a valid config object without throwing', () => {
    const config = parseRawConfig({
      mode: 'sitemap',
      maxPages: 100,
      auth: { type: 'basic', username: 'u', password: 'p' }
    })

    expect(config.mode).toBe('sitemap')
    expect(config.maxPages).toBe(100)
    expect(config.auth.type).toBe('basic')
  })

  it('applies DEFAULTS when optional fields are omitted', () => {
    const config = parseRawConfig({ mode: 'pages' })

    expect(config.mode).toBe('pages')
    expect(config.maxPages).toBe(500)
    expect(config.maxDepth).toBe(10)
    expect(config.auth.type).toBe('none')
    expect(config.excludePatterns).toContain('/logout')
  })

  it('returns defaults for invalid JSON string input', () => {
    const config = parseRawConfig('{ not valid json')

    expect(config.mode).toBe('full')
    expect(config.auth.type).toBe('none')
    expect(config.maxPages).toBe(500)
  })

  it('preserves scan mode from raw config', () => {
    expect(parseRawConfig({ mode: 'pages', pages: ['https://example.com/a'] }).mode).toBe('pages')
    expect(parseRawConfig({ mode: 'invalid', maxPages: 3 }).mode).toBe('full')
  })

  it('coerces numeric fields from string JSON values', () => {
    const config = parseRawConfig({
      mode: 'full',
      maxPages: '1',
      maxDepth: '2',
      concurrency: '3',
      timeout: '45'
    })

    expect(config.maxPages).toBe(1)
    expect(config.maxDepth).toBe(2)
    expect(config.concurrency).toBe(3)
    expect(config.timeout).toBe(45)
  })

  it('parses ScanMode and AuthType enum values', () => {
    const config = parseRawConfig({
      mode: 'full',
      auth: { type: 'bearer', token: 'secret' }
    })

    expect(['full', 'pages', 'sitemap']).toContain(config.mode)
    expect(config.auth.type).toBe('bearer')
    expect(config.auth.token).toBe('secret')
  })

  it('ignores legacy reporting keys on parse', () => {
    const config = parseRawConfig({
      mode: 'full',
      wcagLevels: [],
      checkLinks: false
    })

    expect(config.mode).toBe('full')
    expect('wcagLevels' in config).toBe(false)
  })
})

describe('mergeRawScanConfigs', () => {
  it('merges site defaults with queue overrides', () => {
    const merged = mergeRawScanConfigs(
      { mode: 'full', maxPages: 500 },
      { mode: 'pages', pages: ['https://example.com/one'] }
    )

    expect(merged.mode).toBe('pages')
    expect(merged.maxPages).toBe(500)
    expect(merged.pages).toEqual(['https://example.com/one'])
  })
})

describe('deriveScanTypeFromRaw', () => {
  it('always returns full', () => {
    expect(deriveScanTypeFromRaw({ wcagLevels: [] })).toBe('full')
    expect(deriveScanTypeFromRaw({ checkLinks: false })).toBe('full')
  })
})

describe('wait strategy', () => {
  it('maps legacy delay5s to delay10s with 10s post-load pause', () => {
    const config = parseRawConfig({ waitStrategy: 'delay5s' })
    expect(config.waitStrategy).toBe('delay10s')
    expect(getPostLoadDelay(config.waitStrategy)).toBe(10_000)
  })

  it('delay10s uses 10s post-load pause', () => {
    expect(getPostLoadDelay('delay10s')).toBe(10_000)
  })
})
