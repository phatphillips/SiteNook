export type ScanMode = 'full' | 'pages' | 'sitemap'
export type AuthType = 'none' | 'basic' | 'form' | 'cookie' | 'bearer'
export type ViewportPreset = 'desktop' | 'tablet' | 'mobile'
export type WaitStrategy = 'load' | 'networkidle' | 'delay2s' | 'delay5s' | 'delay10s'
export type ScheduleFrequency = 'hourly' | 'every_6h' | 'every_5d' | 'daily' | 'weekly' | 'monthly'

export interface ScanAuthConfig {
  type: AuthType
  username?: string
  password?: string
  loginUrl?: string
  usernameSelector?: string
  passwordSelector?: string
  submitSelector?: string
  cookieString?: string
  token?: string
}

/** Crawl / browser execution settings (stored in default_scan_config). */
export interface ScanConfig {
  mode: ScanMode
  pages: string[]
  sitemapUrl: string
  maxPages: number
  maxDepth: number
  stayOnDomain: boolean
  respectRobots: boolean
  includePatterns: string[]
  excludePatterns: string[]
  viewport: ViewportPreset
  waitStrategy: WaitStrategy
  concurrency: number
  timeout: number
  auth: ScanAuthConfig
  scheduleEnabled: boolean
  scheduleFrequency: ScheduleFrequency
  scheduleTime: string
  customHeaders: Record<string, string>
  userAgent: string | null
}

export interface HeaderRow {
  key: string
  value: string
}

const DEFAULT_EXCLUDE = ['/logout', '/wp-admin/*', '/cdn-cgi/*']

export function coercePositiveInt(value: unknown, fallback: number, max?: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return fallback
  if (max != null) return Math.min(max, n)
  return n
}

export function normalizeScanConfig(config: ScanConfig): ScanConfig {
  const waitStrategy = config.waitStrategy === 'delay5s' ? 'delay10s' : config.waitStrategy
  return {
    ...config,
    waitStrategy,
    maxPages: coercePositiveInt(config.maxPages, 500),
    maxDepth: coercePositiveInt(config.maxDepth, 10),
    concurrency: coercePositiveInt(config.concurrency, 3, 10),
    timeout: coercePositiveInt(config.timeout, 30)
  }
}

export function getDefaultScanConfig(siteUrl?: string, maxPages = 500): ScanConfig {
  let sitemapUrl = ''
  if (siteUrl) {
    try {
      const u = new URL(siteUrl)
      sitemapUrl = `${u.origin}/sitemap.xml`
    } catch {
      sitemapUrl = ''
    }
  }

  return {
    mode: 'full',
    pages: [],
    sitemapUrl,
    maxPages,
    maxDepth: 10,
    stayOnDomain: true,
    respectRobots: true,
    includePatterns: [],
    excludePatterns: [...DEFAULT_EXCLUDE],
    viewport: 'desktop',
    waitStrategy: 'load',
    concurrency: 3,
    timeout: 30,
    auth: {
      type: 'none',
      usernameSelector: 'input[type=email], input[name=email]',
      passwordSelector: 'input[type=password]',
      submitSelector: 'button[type=submit]'
    },
    scheduleEnabled: true,
    scheduleFrequency: 'daily',
    scheduleTime: '14:00',
    customHeaders: {},
    userAgent: null
  }
}

/** Merge queue/rescan overrides onto a site's saved default_scan_config. */
export function mergeScanConfigRaw(base: unknown, override: unknown): Record<string, unknown> {
  const b = base && typeof base === 'object' ? (base as Record<string, unknown>) : {}
  const o = override && typeof override === 'object' ? (override as Record<string, unknown>) : {}
  return {
    ...b,
    ...o,
    auth: { ...(b.auth as Record<string, unknown> || {}), ...(o.auth as Record<string, unknown> || {}) },
    includePatterns: (o.includePatterns as string[] | undefined) ?? (b.includePatterns as string[] | undefined),
    excludePatterns: (o.excludePatterns as string[] | undefined) ?? (b.excludePatterns as string[] | undefined),
    pages: (o.pages as string[] | undefined) ?? (b.pages as string[] | undefined),
    customHeaders: {
      ...(b.customHeaders as Record<string, string> || {}),
      ...(o.customHeaders as Record<string, string> || {})
    }
  }
}

export function parseScanConfig(raw: unknown, siteUrl?: string, maxPages = 500): ScanConfig {
  const defaults = getDefaultScanConfig(siteUrl, maxPages)
  if (!raw || typeof raw !== 'object') return defaults

  const data = raw as Partial<ScanConfig> & {
    schedule?: { frequency?: ScheduleFrequency, time?: string, timezone?: string } | null
  }

  const parsed: ScanConfig = {
    ...defaults,
    ...data,
    auth: { ...defaults.auth, ...(data.auth || {}) },
    includePatterns: data.includePatterns ?? defaults.includePatterns,
    excludePatterns: data.excludePatterns ?? defaults.excludePatterns,
    pages: data.pages ?? defaults.pages,
    customHeaders: data.customHeaders ?? defaults.customHeaders
  }

  if (data.schedule) {
    parsed.scheduleEnabled = true
    parsed.scheduleFrequency = data.schedule.frequency ?? defaults.scheduleFrequency
    parsed.scheduleTime = data.schedule.time ?? defaults.scheduleTime
  }

  return normalizeScanConfig(parsed)
}

export function headerRowsFromConfig(headers: Record<string, string>): HeaderRow[] {
  const entries = Object.entries(headers)
  if (!entries.length) return [{ key: '', value: '' }]
  return entries.map(([key, value]) => ({ key, value }))
}

export function configFromHeaderRows(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (key) out[key] = row.value
  }
  return out
}

/** Scans always run full accessibility + QA inventory. */
export function deriveScanType(_config: ScanConfig): 'full' {
  return 'full'
}

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function serializeScanConfig(
  config: ScanConfig,
  options?: { scheduleTimezone?: string }
): Record<string, unknown> {
  const normalized = normalizeScanConfig(config)
  const { scheduleEnabled, scheduleFrequency, scheduleTime, ...raw } = normalized
  const scheduleTimezone = options?.scheduleTimezone ?? getBrowserTimezone()
  return {
    ...raw,
    schedule: scheduleEnabled
      ? {
          frequency: scheduleFrequency,
          time: scheduleTime,
          timezone: scheduleTimezone
        }
      : null
  }
}

export function getSiteHostname(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname
  } catch {
    return siteUrl
  }
}

export function countPageUrls(text: string): number {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean).length
}

export function parsePageUrls(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateAuth(config: ScanConfig): string[] {
  const errors: string[] = []
  const { auth } = config
  if (auth.type === 'none') return errors

  if (auth.type === 'basic') {
    if (!auth.username?.trim()) errors.push('Username is required for HTTP Basic Auth')
    if (!auth.password?.trim()) errors.push('Password is required for HTTP Basic Auth')
  }
  if (auth.type === 'form') {
    if (!auth.loginUrl?.trim()) errors.push('Login page URL is required')
    if (!auth.username?.trim()) errors.push('Username value is required')
    if (!auth.password?.trim()) errors.push('Password value is required')
  }
  if (auth.type === 'cookie' && !auth.cookieString?.trim()) {
    errors.push('Cookie string is required')
  }
  if (auth.type === 'bearer' && !auth.token?.trim()) {
    errors.push('Bearer token is required')
  }
  return errors
}

export function scopeSummary(config: ScanConfig, pageCount?: number): string {
  const modeLabels: Record<ScanMode, string> = {
    full: 'Full crawl',
    pages: 'Specific pages',
    sitemap: 'Sitemap'
  }
  const mode = config.mode === 'pages'
    ? `${pageCount ?? config.pages.length} URLs`
    : modeLabels[config.mode]
  const limit = config.mode === 'pages' ? '' : ` · Limit ${config.maxPages}`
  return `${mode}${limit}`
}

export function browserSummary(config: ScanConfig): string {
  const vp = config.viewport.charAt(0).toUpperCase() + config.viewport.slice(1)
  const waitLabels: Record<WaitStrategy, string> = {
    load: 'Load event',
    networkidle: 'Network idle',
    delay2s: 'Delay 2s',
    delay5s: 'Delay 10s',
    delay10s: 'Delay 10s'
  }
  return `${vp} · ${waitLabels[config.waitStrategy]} · Concurrency ${config.concurrency}`
}

export function authSummary(config: ScanConfig): string {
  const labels: Record<AuthType, string> = {
    none: 'None',
    basic: 'HTTP Basic',
    form: 'Login form',
    cookie: 'Cookie / Session',
    bearer: 'Bearer token'
  }
  return labels[config.auth.type]
}

export function scheduleSummary(config: ScanConfig): string {
  if (!config.scheduleEnabled) return 'Manual only'
  return `${config.scheduleFrequency} · ${config.scheduleTime}`
}

export function advancedSummary(config: ScanConfig): string {
  const headerCount = Object.keys(config.customHeaders).length
  const ua = config.userAgent ? 'Custom UA' : 'Default UA'
  return headerCount ? `${headerCount} headers · ${ua}` : ua
}

export function frequencyToCrawlSchedule(frequency: ScheduleFrequency): string {
  return frequency
}
