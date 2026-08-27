import { describe, expect, it } from 'vitest'
import {
  PROVIDER_FIELD_SCHEMAS,
  emptySummary,
  lastCompleteUtcRange,
  ALL_ANALYTICS_PROVIDERS
} from '../../../server/utils/analytics/types'
import { validateCredentialFields } from '../../../server/utils/analytics/connections'
import { matomoAdapter } from '../../../server/utils/analytics/providers/matomo'
import { plausibleAdapter } from '../../../server/utils/analytics/providers/plausible'
import { AnalyticsProviderError } from '../../../server/utils/analytics/types'

describe('analytics types and schemas', () => {
  it('defines fields for all credential providers', () => {
    for (const provider of ALL_ANALYTICS_PROVIDERS) {
      expect(PROVIDER_FIELD_SCHEMAS[provider]).toBeDefined()
    }
    expect(PROVIDER_FIELD_SCHEMAS.ga4).toEqual([])
    expect(PROVIDER_FIELD_SCHEMAS.umami.some((f) => f.key === 'instanceUrl' && f.required)).toBe(true)
    expect(PROVIDER_FIELD_SCHEMAS.matomo.some((f) => f.key === 'instanceUrl' && f.required)).toBe(true)
    expect(PROVIDER_FIELD_SCHEMAS.fathom.some((f) => f.key === 'instanceUrl')).toBe(false)
    expect(PROVIDER_FIELD_SCHEMAS.plausible.find((f) => f.key === 'instanceUrl')?.required).toBe(false)
    expect(PROVIDER_FIELD_SCHEMAS.plausible[0]?.key).toBe('siteId')
  })

  it('emptySummary keeps nulls', () => {
    const s = emptySummary({ visitors: 10 })
    expect(s.visitors).toBe(10)
    expect(s.sessions).toBeNull()
    expect(s.pageviews).toBeNull()
  })

  it('lastCompleteUtcRange excludes today', () => {
    const range = lastCompleteUtcRange(28)
    const today = new Date().toISOString().slice(0, 10)
    expect(range.end).not.toBe(today)
    expect(range.start < range.end || range.start === range.end).toBe(true)
  })

  it('validateCredentialFields enforces required keys', () => {
    expect(validateCredentialFields('cloudflare', {})).toMatch(/API token/i)
    expect(validateCredentialFields('cloudflare', { apiToken: 't', zoneId: 'z' })).toBeNull()
    expect(validateCredentialFields('ga4', {})).toMatch(/OAuth/i)
    expect(validateCredentialFields('ga4', { refreshToken: 'r' })).toBeNull()
  })
})

describe('plausible adapter validation', () => {
  it('detects swapped site domain and API key', async () => {
    const result = await plausibleAdapter.testConnection({
      apiKey: 'plausible.io',
      siteId: 'anon-user-test-token',
      instanceUrl: 'https://plausible.io'
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/swapped|Site domain/i)
  })

  it('surfaces provider JSON auth errors instead of raw body', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ error: 'Invalid API key or site ID. Please make sure you are using a valid API key.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ) as any

    try {
      const result = await plausibleAdapter.testConnection({
        apiKey: 'real-looking-key',
        siteId: 'plausible.io',
        instanceUrl: 'https://plausible.io'
      })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Invalid API key/i)
      expect(result.error).not.toMatch(/^\s*\{/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('matomo adapter error classification', () => {
  it('surfaces auth errors from Matomo result=error', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ result: 'error', message: 'Login failed with token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }) as any

    try {
      await expect(
        matomoAdapter.fetchSummary(
          {
            tokenAuth: 'bad',
            instanceUrl: 'https://matomo.example.com',
            siteId: '1'
          },
          { start: '2026-01-01', end: '2026-01-28' }
        )
      ).rejects.toBeInstanceOf(AnalyticsProviderError)

      try {
        await matomoAdapter.fetchSummary(
          {
            tokenAuth: 'bad',
            instanceUrl: 'https://matomo.example.com',
            siteId: '1'
          },
          { start: '2026-01-01', end: '2026-01-28' }
        )
      } catch (e) {
        expect(e).toBeInstanceOf(AnalyticsProviderError)
        expect((e as AnalyticsProviderError).kind).toBe('auth_error')
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('normalizes VisitsSummary response', async () => {
    const originalFetch = globalThis.fetch
    let call = 0
    globalThis.fetch = async () => {
      call += 1
      if (call === 1) {
        return new Response(
          JSON.stringify({
            nb_visits: 100,
            nb_uniq_visitors: 80,
            nb_pageviews: 250,
            bounce_rate: '45%'
          }),
          { status: 200 }
        ) as any
      }
      if (call === 2) {
        return new Response(JSON.stringify([{ label: '/home', nb_hits: 40 }]), {
          status: 200
        }) as any
      }
      return new Response(JSON.stringify([{ label: 'google', nb_uniq_visitors: 20 }]), {
        status: 200
      }) as any
    }

    try {
      const summary = await matomoAdapter.fetchSummary(
        {
          tokenAuth: 'token',
          instanceUrl: 'https://matomo.example.com',
          siteId: '1'
        },
        { start: '2026-01-01', end: '2026-01-28' }
      )
      expect(summary.sessions).toBe(100)
      expect(summary.visitors).toBe(80)
      expect(summary.pageviews).toBe(250)
      expect(summary.bounceRate).toBeCloseTo(0.45)
      expect(summary.topPages?.[0]?.path).toBe('/home')
      expect(summary.topSources?.[0]?.source).toBe('google')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
