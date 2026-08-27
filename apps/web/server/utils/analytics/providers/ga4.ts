import type { AnalyticsProviderAdapter, DateRange, ProviderCredentials, SelectableResource } from '../types'
import {
  AnalyticsProviderError,
  emptySummary,
  classifyHttpError,
  readJsonOrThrow
} from '../types'
import type { NormalizedAnalyticsSummary } from '~/types/sitenook'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

function requireGa4Creds(credentials: ProviderCredentials) {
  const accessToken = credentials.accessToken?.trim()
  const refreshToken = credentials.refreshToken?.trim()
  const propertyId = credentials.propertyId?.trim()
  const clientId = credentials.clientId?.trim()
  const clientSecret = credentials.clientSecret?.trim()
  return { accessToken, refreshToken, propertyId, clientId, clientSecret }
}

async function ga4Fetch(accessToken: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  return res
}

async function refreshAccessToken(credentials: ProviderCredentials): Promise<ProviderCredentials> {
  const { refreshToken, clientId, clientSecret } = requireGa4Creds(credentials)
  if (!refreshToken || !clientId || !clientSecret) {
    throw new AnalyticsProviderError('auth_error', 'Missing GA4 refresh credentials')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const json = (await readJsonOrThrow(res)) as {
    access_token?: string
    expires_in?: number
    error?: string
  }

  if (!json.access_token) {
    throw new AnalyticsProviderError('auth_error', json.error || 'Failed to refresh GA4 token')
  }

  return {
    ...credentials,
    accessToken: json.access_token,
    expiresAt: String(Date.now() + (json.expires_in || 3600) * 1000)
  }
}

async function withFreshToken(
  credentials: ProviderCredentials,
  fn: (accessToken: string) => Promise<Response>
): Promise<{ res: Response, credentials: ProviderCredentials }> {
  let creds = credentials
  const expiresAt = Number(creds.expiresAt || 0)
  if (!creds.accessToken || (expiresAt && Date.now() > expiresAt - 60_000)) {
    if (creds.refreshToken) {
      creds = await refreshAccessToken(creds)
    }
  }

  let res = await fn(creds.accessToken!)
  if (res.status === 401 && creds.refreshToken) {
    creds = await refreshAccessToken(creds)
    res = await fn(creds.accessToken!)
  }
  return { res, credentials: creds }
}

function propertyResourceName(propertyId: string): string {
  return propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`
}

async function runReport(
  accessToken: string,
  propertyId: string,
  range: DateRange,
  metrics: string[],
  dimensions?: string[],
  limit?: number
): Promise<unknown> {
  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    metrics: metrics.map((name) => ({ name })),
    keepEmptyRows: false
  }
  if (dimensions?.length) {
    body.dimensions = dimensions.map((name) => ({ name }))
  }
  if (limit) {
    body.limit = String(limit)
    body.orderBys = [{ metric: { metricName: metrics[0] }, desc: true }]
  }

  const res = await ga4Fetch(
    accessToken,
    `${DATA_API}/${propertyResourceName(propertyId)}:runReport`,
    { method: 'POST', body: JSON.stringify(body) }
  )
  return readJsonOrThrow(res)
}

function metricValue(report: any, index: number): number | null {
  const row = report?.rows?.[0]
  const value = row?.metricValues?.[index]?.value
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const ga4Adapter: AnalyticsProviderAdapter = {
  async testConnection(credentials) {
    try {
      const { propertyId } = requireGa4Creds(credentials)
      if (!propertyId && !credentials.refreshToken && !credentials.accessToken) {
        return { ok: false, error: 'Connect with Google OAuth first' }
      }
      const { res } = await withFreshToken(credentials, (token) => {
        if (propertyId) {
          return ga4Fetch(token, `${ADMIN_API}/${propertyResourceName(propertyId)}`)
        }
        return ga4Fetch(token, `${ADMIN_API}/accountSummaries?pageSize=1`)
      })
      if (!res.ok) {
        const text = await res.text()
        throw classifyHttpError(res.status, text)
      }
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      return { ok: false, error: message }
    }
  },

  async listSelectableResources(credentials): Promise<SelectableResource[]> {
    const { res, credentials: fresh } = await withFreshToken(credentials, (token) =>
      ga4Fetch(token, `${ADMIN_API}/accountSummaries?pageSize=200`)
    )
    const json = (await readJsonOrThrow(res)) as {
      accountSummaries?: Array<{
        displayName?: string
        propertySummaries?: Array<{ property?: string, displayName?: string }>
      }>
    }
    void fresh

    const items: SelectableResource[] = []
    for (const account of json.accountSummaries || []) {
      for (const prop of account.propertySummaries || []) {
        if (!prop.property) continue
        const id = prop.property.replace(/^properties\//, '')
        const label = prop.displayName
          ? `${prop.displayName} (${id})`
          : id
        items.push({ id, label })
      }
    }
    return items
  },

  async refreshCredentials(credentials) {
    return refreshAccessToken(credentials)
  },

  async fetchSummary(credentials, range): Promise<NormalizedAnalyticsSummary> {
    const { propertyId } = requireGa4Creds(credentials)
    if (!propertyId) {
      throw new AnalyticsProviderError('provider_error', 'GA4 property ID is required')
    }

    const { res: summaryRes, credentials: fresh } = await withFreshToken(credentials, (token) =>
      ga4Fetch(token, `${DATA_API}/${propertyResourceName(propertyId)}:runReport`, {
        method: 'POST',
        body: JSON.stringify({
          dateRanges: [{ startDate: range.start, endDate: range.end }],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'engagementRate' }
          ]
        })
      })
    )
    const summary = await readJsonOrThrow(summaryRes)

    let topPages: NormalizedAnalyticsSummary['topPages'] = null
    let topSources: NormalizedAnalyticsSummary['topSources'] = null

    try {
      const pagesReport = await runReport(
        fresh.accessToken!,
        propertyId,
        range,
        ['screenPageViews'],
        ['pagePath'],
        10
      ) as any
      topPages = (pagesReport.rows || []).map((row: any) => ({
        path: String(row.dimensionValues?.[0]?.value || ''),
        pageviews: Number(row.metricValues?.[0]?.value) || null
      }))
    } catch {
      topPages = null
    }

    try {
      const sourcesReport = await runReport(
        fresh.accessToken!,
        propertyId,
        range,
        ['activeUsers'],
        ['sessionSource'],
        10
      ) as any
      topSources = (sourcesReport.rows || []).map((row: any) => ({
        source: String(row.dimensionValues?.[0]?.value || ''),
        visitors: Number(row.metricValues?.[0]?.value) || null
      }))
    } catch {
      topSources = null
    }

    const bounce = metricValue(summary, 3)
    const engagement = metricValue(summary, 4)

    return emptySummary({
      sessions: metricValue(summary, 0),
      visitors: metricValue(summary, 1),
      pageviews: metricValue(summary, 2),
      bounceRate: bounce == null ? null : bounce > 1 ? bounce / 100 : bounce,
      engagementRate: engagement == null ? null : engagement > 1 ? engagement / 100 : engagement,
      topPages,
      topSources,
      timezone: 'UTC'
    })
  }
}

export { refreshAccessToken as refreshGa4AccessToken }
