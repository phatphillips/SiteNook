import type { AnalyticsProvider, NormalizedAnalyticsSummary } from '~/types/sitenook'

export type { NormalizedAnalyticsSummary }

export interface DateRange {
  start: string // YYYY-MM-DD (UTC)
  end: string // YYYY-MM-DD inclusive last complete day
}

export interface SelectableResource {
  id: string
  label: string
}

export type ProviderCredentials = Record<string, string>

export class AnalyticsProviderError extends Error {
  readonly kind: 'auth_error' | 'rate_limited' | 'provider_error'

  constructor(kind: AnalyticsProviderError['kind'], message: string) {
    super(message)
    this.name = 'AnalyticsProviderError'
    this.kind = kind
  }
}

export interface AnalyticsProviderAdapter {
  testConnection(credentials: ProviderCredentials): Promise<{ ok: boolean, error?: string }>
  fetchSummary(credentials: ProviderCredentials, range: DateRange): Promise<NormalizedAnalyticsSummary>
  listSelectableResources?(credentials: ProviderCredentials): Promise<SelectableResource[]>
  refreshCredentials?(credentials: ProviderCredentials): Promise<ProviderCredentials>
}

export interface CredentialFieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  required: boolean
  placeholder?: string
  help?: string
}

export function emptySummary(partial?: Partial<NormalizedAnalyticsSummary>): NormalizedAnalyticsSummary {
  return {
    sessions: null,
    visitors: null,
    pageviews: null,
    bounceRate: null,
    engagementRate: null,
    topPages: null,
    topSources: null,
    timezone: null,
    asOf: new Date().toISOString(),
    ...partial
  }
}

export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Last `days` complete UTC days, excluding today. */
export function lastCompleteUtcRange(days = 28): DateRange {
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { start: utcDateString(start), end: utcDateString(end) }
}

export function humanizeProviderHttpBody(bodyText?: string): string {
  const raw = (bodyText || '').trim()
  if (!raw) return ''
  try {
    const json = JSON.parse(raw) as { error?: string, message?: string }
    const msg = String(json.error || json.message || '').trim()
    if (msg) return msg.slice(0, 300)
  } catch {
    // not JSON
  }
  return raw.slice(0, 300)
}

export function classifyHttpError(status: number, bodyText?: string): AnalyticsProviderError {
  const message = humanizeProviderHttpBody(bodyText)
  if (status === 401 || status === 403) {
    return new AnalyticsProviderError('auth_error', message || 'Authentication failed')
  }
  if (status === 429) {
    return new AnalyticsProviderError('rate_limited', message || 'Rate limited by provider')
  }
  return new AnalyticsProviderError(
    'provider_error',
    message || `Provider returned HTTP ${status}`
  )
}

/** Turn undici/"TypeError: fetch failed" into something actionable. */
export function humanizeFetchFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'Connection failed'
  if (error instanceof AnalyticsProviderError) return error.message

  const parts: string[] = []
  let current: unknown = error
  for (let i = 0; i < 4 && current; i++) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message)
      current = (current as Error & { cause?: unknown }).cause
      continue
    }
    if (typeof current === 'object' && current && 'code' in current) {
      parts.push(String((current as { code?: string }).code))
    }
    break
  }

  const joined = parts.filter(Boolean).join(' — ')
  if (/fetch failed/i.test(joined) || /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|CERT/i.test(joined)) {
    return `Could not reach the analytics provider (${joined}). Check the instance URL and that the SiteNook server has outbound internet access.`
  }
  return joined || 'Connection failed'
}

export async function readJsonOrThrow(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!res.ok) {
    throw classifyHttpError(res.status, text)
  }
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new AnalyticsProviderError('provider_error', 'Provider returned invalid JSON')
  }
}

export const PROVIDER_FIELD_SCHEMAS: Record<AnalyticsProvider, CredentialFieldDef[]> = {
  ga4: [],
  cloudflare: [
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true,
      help: 'Zone-scoped token with Analytics Read permission'
    },
    {
      key: 'zoneId',
      label: 'Zone ID',
      type: 'text',
      required: true,
      placeholder: '32-character zone ID'
    }
  ],
  plausible: [
    {
      key: 'siteId',
      label: 'Site domain',
      type: 'text',
      required: true,
      placeholder: 'example.com',
      help: 'Exact domain in Plausible (e.g. plausible.io) — not your API key'
    },
    {
      key: 'apiKey',
      label: 'API key',
      type: 'password',
      required: true,
      placeholder: 'plausible-api-…',
      help: 'Create under Plausible → Settings → API keys (Stats API)'
    },
    {
      key: 'instanceUrl',
      label: 'Instance URL',
      type: 'url',
      required: false,
      placeholder: 'https://plausible.io',
      help: 'Leave blank for Plausible Cloud; set for self-hosted'
    }
  ],
  umami: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'password',
      required: true
    },
    {
      key: 'instanceUrl',
      label: 'Instance URL',
      type: 'url',
      required: true,
      placeholder: 'https://analytics.example.com'
    },
    {
      key: 'websiteId',
      label: 'Website ID',
      type: 'text',
      required: true
    }
  ],
  fathom: [
    {
      key: 'apiToken',
      label: 'API token',
      type: 'password',
      required: true
    },
    {
      key: 'siteId',
      label: 'Site ID',
      type: 'text',
      required: true
    }
  ],
  matomo: [
    {
      key: 'tokenAuth',
      label: 'Token auth',
      type: 'password',
      required: true
    },
    {
      key: 'instanceUrl',
      label: 'Instance URL',
      type: 'url',
      required: true,
      placeholder: 'https://matomo.example.com'
    },
    {
      key: 'siteId',
      label: 'Site ID',
      type: 'text',
      required: true
    }
  ]
}

export const PROVIDER_META: Record<
  AnalyticsProvider,
  { name: string, description: string, monogram: string }
> = {
  ga4: {
    name: 'Google Analytics 4',
    description: 'Connect via Google OAuth and pick a GA4 property.',
    monogram: 'G'
  },
  cloudflare: {
    name: 'Cloudflare Web Analytics',
    description: 'Zone API token and zone ID for traffic summaries.',
    monogram: 'C'
  },
  plausible: {
    name: 'Plausible Analytics',
    description: 'API key and site ID (Cloud or self-hosted).',
    monogram: 'P'
  },
  umami: {
    name: 'Umami',
    description: 'Self-hosted or cloud Umami instance with API key.',
    monogram: 'U'
  },
  fathom: {
    name: 'Fathom Analytics',
    description: 'API token and site ID from your Fathom dashboard.',
    monogram: 'F'
  },
  matomo: {
    name: 'Matomo',
    description: 'token_auth plus your Matomo instance URL and site ID.',
    monogram: 'M'
  }
}

export const ALL_ANALYTICS_PROVIDERS: AnalyticsProvider[] = [
  'ga4',
  'cloudflare',
  'plausible',
  'umami',
  'fathom',
  'matomo'
]
