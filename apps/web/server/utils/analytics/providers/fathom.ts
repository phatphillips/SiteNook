import type { AnalyticsProviderAdapter, ProviderCredentials } from '../types'
import {
  AnalyticsProviderError,
  emptySummary,
  readJsonOrThrow
} from '../types'

const API = 'https://api.usefathom.com/v1'

function requireCreds(credentials: ProviderCredentials) {
  const apiToken = credentials.apiToken?.trim()
  const siteId = credentials.siteId?.trim()
  if (!apiToken || !siteId) {
    throw new AnalyticsProviderError('provider_error', 'API token and site ID are required')
  }
  return { apiToken, siteId }
}

async function fathomGet(apiToken: string, path: string, params: Record<string, string>) {
  const url = new URL(`${API}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json'
    }
  })
  return readJsonOrThrow(res)
}

export const fathomAdapter: AnalyticsProviderAdapter = {
  async testConnection(credentials) {
    try {
      const { apiToken, siteId } = requireCreds(credentials)
      await fathomGet(apiToken, '/aggregations', {
        entity: 'pageview',
        entity_id: siteId,
        aggregates: 'visits,uniques,pageviews',
        date_from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        date_to: new Date().toISOString().slice(0, 10)
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async fetchSummary(credentials, range) {
    const { apiToken, siteId } = requireCreds(credentials)
    const aggregates = (await fathomGet(apiToken, '/aggregations', {
      entity: 'pageview',
      entity_id: siteId,
      aggregates: 'visits,uniques,pageviews,bounce_rate',
      date_from: range.start,
      date_to: range.end
    })) as Array<{
      visits?: number
      uniques?: number
      pageviews?: number
      bounce_rate?: number
    }> | {
      visits?: number
      uniques?: number
      pageviews?: number
      bounce_rate?: number
    }

    const row = Array.isArray(aggregates) ? aggregates[0] || {} : aggregates || {}
    let bounceRate = typeof row.bounce_rate === 'number' ? row.bounce_rate : null
    if (bounceRate != null && bounceRate > 1) bounceRate = bounceRate / 100

    let topPages = null
    try {
      const pages = (await fathomGet(apiToken, '/aggregations', {
        entity: 'pageview',
        entity_id: siteId,
        aggregates: 'pageviews',
        date_from: range.start,
        date_to: range.end,
        group_by: 'pathname',
        sort_by: 'pageviews:desc',
        limit: '10'
      })) as Array<{ pathname?: string, pageviews?: number }>
      topPages = (pages || []).slice(0, 10).map((p) => ({
        path: String(p.pathname || ''),
        pageviews: typeof p.pageviews === 'number' ? p.pageviews : null
      }))
    } catch {
      topPages = null
    }

    let topSources = null
    try {
      const sources = (await fathomGet(apiToken, '/aggregations', {
        entity: 'pageview',
        entity_id: siteId,
        aggregates: 'uniques',
        date_from: range.start,
        date_to: range.end,
        group_by: 'referrer_hostname',
        sort_by: 'uniques:desc',
        limit: '10'
      })) as Array<{ referrer_hostname?: string, uniques?: number }>
      topSources = (sources || []).slice(0, 10).map((s) => ({
        source: String(s.referrer_hostname || '') || '(direct)',
        visitors: typeof s.uniques === 'number' ? s.uniques : null
      }))
    } catch {
      topSources = null
    }

    return emptySummary({
      sessions: typeof row.visits === 'number' ? row.visits : null,
      visitors: typeof row.uniques === 'number' ? row.uniques : null,
      pageviews: typeof row.pageviews === 'number' ? row.pageviews : null,
      bounceRate,
      topPages,
      topSources,
      timezone: 'UTC'
    })
  }
}
