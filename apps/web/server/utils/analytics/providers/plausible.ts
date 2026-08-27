import type { AnalyticsProviderAdapter, ProviderCredentials } from '../types'
import {
  AnalyticsProviderError,
  emptySummary,
  humanizeFetchFailure,
  readJsonOrThrow
} from '../types'

function looksLikeDomain(value: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value) || value.includes('.')
}

function requireCreds(credentials: ProviderCredentials) {
  const apiKey = credentials.apiKey?.trim()
  const siteId = credentials.siteId?.trim()
  if (!apiKey || !siteId) {
    throw new AnalyticsProviderError('provider_error', 'API key and site domain are required')
  }

  // Common mix-up: API key pasted into site domain (and vice versa)
  if (!looksLikeDomain(siteId) && looksLikeDomain(apiKey)) {
    throw new AnalyticsProviderError(
      'provider_error',
      'Site domain and API key look swapped. Put the domain (e.g. example.com) in Site domain, and the Stats API key in API key.'
    )
  }
  if (/token/i.test(siteId) && !looksLikeDomain(siteId)) {
    throw new AnalyticsProviderError(
      'provider_error',
      'Site domain should be your Plausible site domain (e.g. example.com), not an API key.'
    )
  }

  const base = (credentials.instanceUrl?.trim() || 'https://plausible.io').replace(/\/$/, '')
  return { apiKey, siteId, base }
}

async function query(
  credentials: ProviderCredentials,
  body: Record<string, unknown>
) {
  const { apiKey, base } = requireCreds(credentials)
  let res: Response
  try {
    res = await fetch(`${base}/api/v2/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch (error) {
    throw new AnalyticsProviderError('provider_error', humanizeFetchFailure(error))
  }
  return readJsonOrThrow(res)
}

export const plausibleAdapter: AnalyticsProviderAdapter = {
  async testConnection(credentials) {
    try {
      const { siteId } = requireCreds(credentials)
      await query(credentials, {
        site_id: siteId,
        metrics: ['visitors'],
        date_range: '7d'
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: humanizeFetchFailure(error) }
    }
  },

  async fetchSummary(credentials, range) {
    const { siteId } = requireCreds(credentials)
    const dateRange = [range.start, range.end]

    const aggregate = (await query(credentials, {
      site_id: siteId,
      metrics: ['visitors', 'visits', 'pageviews', 'bounce_rate'],
      date_range: dateRange
    })) as { results?: Array<{ metrics?: number[] }> }

    const metrics = aggregate.results?.[0]?.metrics || []
    const visitors = typeof metrics[0] === 'number' ? metrics[0] : null
    const sessions = typeof metrics[1] === 'number' ? metrics[1] : null
    const pageviews = typeof metrics[2] === 'number' ? metrics[2] : null
    let bounceRate = typeof metrics[3] === 'number' ? metrics[3] : null
    if (bounceRate != null && bounceRate > 1) bounceRate = bounceRate / 100

    let topPages = null
    try {
      const pages = (await query(credentials, {
        site_id: siteId,
        metrics: ['pageviews'],
        date_range: dateRange,
        dimensions: ['event:page'],
        order_by: [['pageviews', 'desc']],
        pagination: { limit: 10 }
      })) as { results?: Array<{ metrics?: number[], dimensions?: string[] }> }
      topPages = (pages.results || []).map((row) => ({
        path: String(row.dimensions?.[0] || ''),
        pageviews: typeof row.metrics?.[0] === 'number' ? row.metrics[0] : null
      }))
    } catch {
      topPages = null
    }

    let topSources = null
    try {
      const sources = (await query(credentials, {
        site_id: siteId,
        metrics: ['visitors'],
        date_range: dateRange,
        dimensions: ['visit:source'],
        order_by: [['visitors', 'desc']],
        pagination: { limit: 10 }
      })) as { results?: Array<{ metrics?: number[], dimensions?: string[] }> }
      topSources = (sources.results || []).map((row) => ({
        source: String(row.dimensions?.[0] || ''),
        visitors: typeof row.metrics?.[0] === 'number' ? row.metrics[0] : null
      }))
    } catch {
      topSources = null
    }

    return emptySummary({
      sessions,
      visitors,
      pageviews,
      bounceRate,
      topPages,
      topSources,
      timezone: 'UTC'
    })
  }
}
