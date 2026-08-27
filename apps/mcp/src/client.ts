export interface SiteNookClientOptions {
  baseUrl: string
  apiKey: string
}

export class SiteNookApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message)
    this.name = 'SiteNookApiError'
  }
}

/** Thin HTTP client for SiteNook /api/agent/* routes. */
export class SiteNookClient {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(options: SiteNookClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
  }

  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === '') continue
        url.searchParams.set(key, String(value))
      }
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })

    const text = await res.text()
    if (!res.ok) {
      let message = text || res.statusText
      try {
        const parsed = JSON.parse(text) as { statusMessage?: string, message?: string }
        message = parsed.statusMessage || parsed.message || message
      } catch {
        // keep text
      }
      throw new SiteNookApiError(message, res.status, text)
    }

    if (!text) return undefined as T
    return JSON.parse(text) as T
  }

  listSites() {
    return this.request<{ items: Array<Record<string, unknown>> }>('GET', '/api/agent/sites')
  }

  getSite(siteId: string) {
    return this.request<Record<string, unknown>>('GET', `/api/agent/sites/${encodeURIComponent(siteId)}`)
  }

  enqueueScan(siteId: string, scanType?: string, rawConfig?: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('POST', `/api/agent/sites/${encodeURIComponent(siteId)}/scans`, {
      scan_type: scanType || 'full',
      raw_config: rawConfig || {}
    })
  }

  getScanStatus(siteId: string) {
    return this.request<Record<string, unknown>>('GET', `/api/agent/sites/${encodeURIComponent(siteId)}/scans`)
  }

  cancelScan(id: string) {
    return this.request<Record<string, unknown>>('POST', `/api/agent/scans/${encodeURIComponent(id)}/cancel`)
  }

  listAccessibilityIssues(siteId: string, query: Record<string, string | number | undefined> = {}) {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/agent/sites/${encodeURIComponent(siteId)}/accessibility/issues`,
      undefined,
      query
    )
  }

  listQaIssues(siteId: string, type: string, page?: number, perPage?: number) {
    return this.request<Record<string, unknown>>(
      'GET',
      `/api/agent/sites/${encodeURIComponent(siteId)}/qa/issues`,
      undefined,
      { type, page, perPage }
    )
  }

  updateQaStatus(siteId: string, issueIds: string[], issueType: string, action: string) {
    return this.request<Record<string, unknown>>(
      'POST',
      `/api/agent/sites/${encodeURIComponent(siteId)}/qa/bulk-status`,
      { issueIds, issueType, action }
    )
  }

  searchContent(q: string, opts: { siteId?: string, mode?: string, type?: string, page?: number } = {}) {
    return this.request<Record<string, unknown>>('GET', '/api/agent/search', undefined, {
      q,
      siteId: opts.siteId,
      mode: opts.mode,
      type: opts.type,
      page: opts.page
    })
  }
}

export function loadClientFromEnv(): SiteNookClient {
  const baseUrl = (
    process.env.SITENOOK_URL
    || process.env.SITENOOK_BASE_URL
    || process.env.ACCESSIQ_URL
    || process.env.ACCESSIQ_BASE_URL
    || ''
  ).trim()
  const apiKey = (process.env.SITENOOK_API_KEY || process.env.ACCESSIQ_API_KEY || '').trim()

  if (!baseUrl) {
    throw new Error('Set SITENOOK_URL to your SiteNook base URL (e.g. http://localhost:3000)')
  }
  if (!apiKey) {
    throw new Error('Set SITENOOK_API_KEY to an org API key from Settings → Integrations')
  }

  return new SiteNookClient({ baseUrl, apiKey })
}
