import type { AnalyticsProviderAdapter, ProviderCredentials } from '../types'
import {
  AnalyticsProviderError,
  emptySummary,
  readJsonOrThrow
} from '../types'

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'

function requireCreds(credentials: ProviderCredentials) {
  const apiToken = credentials.apiToken?.trim()
  const zoneId = credentials.zoneId?.trim()
  if (!apiToken || !zoneId) {
    throw new AnalyticsProviderError('provider_error', 'API token and zone ID are required')
  }
  return { apiToken, zoneId }
}

async function graphql(apiToken: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })
  const json = (await readJsonOrThrow(res)) as {
    data?: any
    errors?: Array<{ message?: string }>
  }
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).filter(Boolean).join('; ')
    const lower = msg.toLowerCase()
    if (lower.includes('auth') || lower.includes('permission') || lower.includes('forbidden')) {
      throw new AnalyticsProviderError('auth_error', msg)
    }
    throw new AnalyticsProviderError('provider_error', msg || 'Cloudflare GraphQL error')
  }
  return json.data
}

export const cloudflareAdapter: AnalyticsProviderAdapter = {
  async testConnection(credentials) {
    try {
      const { apiToken, zoneId } = requireCreds(credentials)
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 2)
      await graphql(
        apiToken,
        `query($zoneTag: string, $start: Time) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(limit: 1, filter: { datetime_gt: $start }) {
                count
              }
            }
          }
        }`,
        { zoneTag: zoneId, start: start.toISOString() }
      )
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async fetchSummary(credentials, range) {
    const { apiToken, zoneId } = requireCreds(credentials)
    const startIso = `${range.start}T00:00:00Z`
    const end = new Date(`${range.end}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 1)
    const endIso = end.toISOString()

    const data = await graphql(
      apiToken,
      `query($zoneTag: string, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            totals: httpRequestsAdaptiveGroups(limit: 1, filter: $filter) {
              count
              sum { visits }
            }
            topPaths: httpRequestsAdaptiveGroups(
              limit: 10,
              filter: $filter,
              orderBy: [count_DESC]
            ) {
              count
              dimensions { clientRequestPath }
            }
          }
        }
      }`,
      {
        zoneTag: zoneId,
        filter: {
          AND: [
            { datetime_geq: startIso, datetime_lt: endIso },
            { requestSource: 'eyeball' }
          ]
        }
      }
    )

    const zone = data?.viewer?.zones?.[0]
    const totals = zone?.totals?.[0]
    const pageviews = typeof totals?.count === 'number' ? totals.count : null
    const visits = typeof totals?.sum?.visits === 'number' ? totals.sum.visits : null

    const topPages = (zone?.topPaths || [])
      .map((row: any) => ({
        path: String(row.dimensions?.clientRequestPath || ''),
        pageviews: typeof row.count === 'number' ? row.count : null
      }))
      .filter((p: { path: string }) => p.path)

    return emptySummary({
      sessions: visits,
      visitors: null,
      pageviews,
      topPages: topPages.length ? topPages : null,
      topSources: null,
      timezone: 'UTC'
    })
  }
}
