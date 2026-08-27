import type { AnalyticsProviderAdapter, ProviderCredentials } from '../types'
import {
  AnalyticsProviderError,
  emptySummary,
  readJsonOrThrow
} from '../types'

function requireCreds(credentials: ProviderCredentials) {
  const tokenAuth = credentials.tokenAuth?.trim()
  const instanceUrl = credentials.instanceUrl?.trim().replace(/\/$/, '')
  const siteId = credentials.siteId?.trim()
  if (!tokenAuth || !instanceUrl || !siteId) {
    throw new AnalyticsProviderError(
      'provider_error',
      'token_auth, instance URL, and site ID are required'
    )
  }
  return { tokenAuth, instanceUrl, siteId }
}

async function matomoCall(
  credentials: ProviderCredentials,
  method: string,
  extra: Record<string, string> = {}
) {
  const { tokenAuth, instanceUrl, siteId } = requireCreds(credentials)
  const url = new URL(`${instanceUrl}/index.php`)
  url.searchParams.set('module', 'API')
  url.searchParams.set('method', method)
  url.searchParams.set('idSite', siteId)
  url.searchParams.set('format', 'JSON')
  url.searchParams.set('token_auth', tokenAuth)
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  })
  const json = await readJsonOrThrow(res)
  if (json && typeof json === 'object' && 'result' in json && (json as any).result === 'error') {
    const msg = String((json as any).message || 'Matomo API error')
    if (/token|auth|permission/i.test(msg)) {
      throw new AnalyticsProviderError('auth_error', msg)
    }
    throw new AnalyticsProviderError('provider_error', msg)
  }
  return json
}

export const matomoAdapter: AnalyticsProviderAdapter = {
  async testConnection(credentials) {
    try {
      await matomoCall(credentials, 'API.getMatomoVersion')
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  },

  async fetchSummary(credentials, range) {
    const period = 'range'
    const date = `${range.start},${range.end}`

    const summary = (await matomoCall(credentials, 'VisitsSummary.get', {
      period,
      date
    })) as {
      nb_visits?: number
      nb_uniq_visitors?: number
      nb_pageviews?: number
      bounce_rate?: string | number
    }

    let bounceRate: number | null = null
    if (typeof summary.bounce_rate === 'number') {
      bounceRate = summary.bounce_rate > 1 ? summary.bounce_rate / 100 : summary.bounce_rate
    } else if (typeof summary.bounce_rate === 'string') {
      const n = Number.parseFloat(summary.bounce_rate.replace('%', ''))
      bounceRate = Number.isFinite(n) ? n / 100 : null
    }

    let topPages = null
    try {
      const pages = (await matomoCall(credentials, 'Actions.getPageUrls', {
        period,
        date,
        filter_limit: '10'
      })) as Array<{ label?: string, nb_hits?: number }>
      topPages = (Array.isArray(pages) ? pages : []).slice(0, 10).map((p) => ({
        path: String(p.label || ''),
        pageviews: typeof p.nb_hits === 'number' ? p.nb_hits : null
      }))
    } catch {
      topPages = null
    }

    let topSources = null
    try {
      const refs = (await matomoCall(credentials, 'Referrers.getAll', {
        period,
        date,
        filter_limit: '10'
      })) as Array<{ label?: string, nb_uniq_visitors?: number }>
      topSources = (Array.isArray(refs) ? refs : []).slice(0, 10).map((r) => ({
        source: String(r.label || ''),
        visitors: typeof r.nb_uniq_visitors === 'number' ? r.nb_uniq_visitors : null
      }))
    } catch {
      topSources = null
    }

    return emptySummary({
      sessions: typeof summary.nb_visits === 'number' ? summary.nb_visits : null,
      visitors: typeof summary.nb_uniq_visitors === 'number' ? summary.nb_uniq_visitors : null,
      pageviews: typeof summary.nb_pageviews === 'number' ? summary.nb_pageviews : null,
      bounceRate,
      topPages,
      topSources,
      timezone: 'UTC'
    })
  }
}
