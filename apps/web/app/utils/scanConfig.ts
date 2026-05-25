export type ScanMode = 'full' | 'pages' | 'sitemap'
export type AuthType = 'none' | 'basic' | 'form' | 'cookie' | 'bearer'
export type ViewportPreset = 'desktop' | 'tablet' | 'mobile'
export type WaitStrategy = 'load' | 'networkidle' | 'delay2s' | 'delay5s'
export type ScheduleFrequency = 'hourly' | 'every_6h' | 'daily' | 'weekly' | 'monthly'

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
  wcagVersion: '2.0' | '2.1' | '2.2'
  wcagLevels: Array<'A' | 'AA' | 'AAA'>
  bestPractices: boolean
  checkLinks: boolean
  checkSpelling: boolean
  spellLanguage: string
  checkReadability: boolean
  runPolicies: boolean
  viewport: ViewportPreset
  waitStrategy: WaitStrategy
  concurrency: number
  timeout: number
  auth: ScanAuthConfig
  notifyEmail: string | null
  diffFromPrevious: boolean
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
    wcagVersion: '2.2',
    wcagLevels: ['A', 'AA', 'AAA'],
    bestPractices: true,
    checkLinks: true,
    checkSpelling: true,
    spellLanguage: 'en-AU',
    checkReadability: true,
    runPolicies: true,
    viewport: 'desktop',
    waitStrategy: 'networkidle',
    concurrency: 3,
    timeout: 30,
    auth: {
      type: 'none',
      usernameSelector: 'input[type=email], input[name=email]',
      passwordSelector: 'input[type=password]',
      submitSelector: 'button[type=submit]'
    },
    notifyEmail: null,
    diffFromPrevious: true,
    scheduleEnabled: false,
    scheduleFrequency: 'daily',
    scheduleTime: '02:00',
    customHeaders: {},
    userAgent: null
  }
}

export function parseScanConfig(raw: unknown, siteUrl?: string, maxPages = 500): ScanConfig {
  const defaults = getDefaultScanConfig(siteUrl, maxPages)
  if (!raw || typeof raw !== 'object') return defaults

  const data = raw as Partial<ScanConfig> & {
    schedule?: { frequency?: ScheduleFrequency, time?: string } | null
  }

  const parsed: ScanConfig = {
    ...defaults,
    ...data,
    auth: { ...defaults.auth, ...(data.auth || {}) },
    includePatterns: data.includePatterns ?? defaults.includePatterns,
    excludePatterns: data.excludePatterns ?? defaults.excludePatterns,
    wcagLevels: data.wcagLevels ?? defaults.wcagLevels,
    pages: data.pages ?? defaults.pages,
    customHeaders: data.customHeaders ?? defaults.customHeaders
  }

  if (data.schedule) {
    parsed.scheduleEnabled = true
    parsed.scheduleFrequency = data.schedule.frequency ?? defaults.scheduleFrequency
    parsed.scheduleTime = data.schedule.time ?? defaults.scheduleTime
  }

  return parsed
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

export function deriveScanType(config: ScanConfig): 'full' | 'accessibility_only' | 'qa_only' {
  const hasA11y = config.wcagLevels.length > 0
  const hasQa = config.checkLinks || config.checkSpelling || config.checkReadability || config.runPolicies
  if (hasA11y && hasQa) return 'full'
  if (hasA11y) return 'accessibility_only'
  if (hasQa) return 'qa_only'
  return 'full'
}

export function serializeScanConfig(config: ScanConfig): Record<string, unknown> {
  const { scheduleEnabled, scheduleFrequency, scheduleTime, ...raw } = config
  return {
    ...raw,
    schedule: scheduleEnabled
      ? { frequency: scheduleFrequency, time: scheduleTime }
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

export function accessibilitySummary(config: ScanConfig): string {
  const levels = config.wcagLevels.join(', ') || 'None'
  const bp = config.bestPractices ? 'Best practices on' : 'Best practices off'
  return `WCAG ${config.wcagVersion} · ${levels} · ${bp}`
}

export function qaSummary(config: ScanConfig): string {
  const parts: string[] = []
  if (config.checkLinks) parts.push('Links')
  if (config.checkSpelling) parts.push('Spelling')
  if (config.checkReadability) parts.push('Readability')
  if (config.runPolicies) parts.push('Policies')
  return parts.length ? parts.join(', ') : 'None'
}

export function browserSummary(config: ScanConfig): string {
  const vp = config.viewport.charAt(0).toUpperCase() + config.viewport.slice(1)
  const waitLabels: Record<WaitStrategy, string> = {
    load: 'Load event',
    networkidle: 'Network idle',
    delay2s: 'Delay 2s',
    delay5s: 'Delay 5s'
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

export function notificationsSummary(config: ScanConfig): string {
  const parts: string[] = []
  if (config.notifyEmail) parts.push('Email on')
  if (config.diffFromPrevious) parts.push('Diff on')
  if (config.scheduleEnabled) parts.push(`Schedule: ${config.scheduleFrequency}`)
  return parts.length ? parts.join(' · ') : 'Defaults'
}

export function advancedSummary(config: ScanConfig): string {
  const headerCount = Object.keys(config.customHeaders).length
  const ua = config.userAgent ? 'Custom UA' : 'Default UA'
  return headerCount ? `${headerCount} headers · ${ua}` : ua
}

export function frequencyToCrawlSchedule(frequency: ScheduleFrequency): string {
  return frequency
}
