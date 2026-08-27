import type { AnalyticsProviderAdapter, ProviderCredentials } from '../types'
import {
  AnalyticsProviderError,
  emptySummary,
  readJsonOrThrow
} from '../types'

function requireCreds(credentials: ProviderCredentials) {
  const apiKey = credentials.apiKey?.trim()
  const instanceUrl = credentials.instanceUrl?.trim().replace(/\/$/, '')
  const websiteId = credentials.websiteId?.trim()
  if (!apiKey || !instanceUrl || !websiteId) {
    throw new AnalyticsProviderError(
      'provider_error',
      'API key, instance URL, and website ID are required'
    )
  }
  return { apiKey, instanceUrl, websiteId }
}

async function umamiGet(
  credentials: ProviderCredentials,
  path: string,
  params: Record<string, string>
) {
  const { apiKey, instanceUrl } = requireCreds(credentials)
  const url = new URL(`${instanceUrl}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  return readJsonOrThrow(res)
}

export const umamiAdapter: AnalyticsProviderAdapter = {
  async testConnection(credentials) {
    try {
      const { websiteId } = requireCreds(credentials)
      const endAt = Date.now()
      const startAt = endAt - 7 * 24 * 60 * 60 * 1000
      await umamiGet(credentials, `/api/websites/${websiteId}/stats`, {
        startAt: String(startAt),
        endAt: String(endAt)
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async fetchSummary(credentials, range) {
    const { websiteId } = requireCreds(credentials)
    const startAt = new Date(`${range.start}T00:00:00Z`).getTime()
    const endAt = new Date(`${range.end}T23:59:59.999Z`).getTime()
    const params = { startAt: String(startAt), endAt: String(endAt) }

    const stats = (await umamiGet(
      credentials,
      `/api/websites/${websiteId}/stats`,
      params
    )) as {
      pageviews?: number
      visitors?: number
      visits?: number
      bounces?: number
    }

    let bounceRate: number | null = null
    if (
      typeof stats.bounces === 'number'
      && typeof stats.visits === 'number'
      && stats.visits > 0
    ) {
      bounceRate = stats.bounces / stats.visits
    }

    let topPages = null
    try {
      const paths = (await umamiGet(credentials, `/api/websites/${websiteId}/metrics`, {
        ...params,
        type: 'path',
        limit: '10'
      })) as Array<{ x?: string, y?: number }>
      topPages = (paths || []).slice(0, 10).map((row) => ({
        path: String(row.x || ''),
        pageviews: typeof row.y === 'number' ? row.y : null
      }))
    } catch {
      topPages = null
    }

    let topSources = null
    try {
      const refs = (await umamiGet(credentials, `/api/websites/${websiteId}/metrics`, {
        ...params,
        type: 'referrer',
        limit: '10'
      })) as Array<{ x?: string, y?: number }>
      topSources = (refs || []).slice(0, 10).map((row) => ({
        source: String(row.x || '') || '(direct)',
        visitors: typeof row.y === 'number' ? row.y : null
      }))
    } catch {
      topSources = null
    }

    return emptySummary({
      sessions: typeof stats.visits === 'number' ? stats.visits : null,
      visitors: typeof stats.visitors === 'number' ? stats.visitors : null,
      pageviews: typeof stats.pageviews === 'number' ? stats.pageviews : null,
      bounceRate,
      topPages,
      topSources,
      timezone: 'UTC'
    })
  }
}
