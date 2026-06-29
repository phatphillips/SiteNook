export interface ScanAuthConfig {
  type: 'none' | 'basic' | 'form' | 'cookie' | 'bearer'
  username?: string
  password?: string
  loginUrl?: string
  usernameSelector?: string
  passwordSelector?: string
  submitSelector?: string
  cookieString?: string
  token?: string
}

/** Crawl / browser execution settings stored in default_scan_config and queue raw_config. */
export interface ParsedScanConfig {
  mode: 'full' | 'pages' | 'sitemap'
  pages: string[]
  sitemapUrl: string
  maxPages: number
  maxDepth: number
  stayOnDomain: boolean
  respectRobots: boolean
  includePatterns: string[]
  excludePatterns: string[]
  viewport: 'desktop' | 'tablet' | 'mobile'
  waitStrategy: 'load' | 'networkidle' | 'delay2s' | 'delay5s' | 'delay10s'
  concurrency: number
  timeout: number
  auth: ScanAuthConfig
  customHeaders: Record<string, string>
  userAgent: string | null
}

function coercePositiveInt(value: unknown, fallback: number, max?: number): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return fallback
  if (max != null) return Math.min(max, n)
  return n
}

const DEFAULTS: ParsedScanConfig = {
  mode: 'full',
  pages: [],
  sitemapUrl: '',
  maxPages: 500,
  maxDepth: 10,
  stayOnDomain: true,
  respectRobots: true,
  includePatterns: [],
  excludePatterns: ['/logout', '/wp-admin/*', '/cdn-cgi/*'],
  viewport: 'desktop',
  waitStrategy: 'load',
  concurrency: 3,
  timeout: 30,
  auth: { type: 'none' },
  customHeaders: {},
  userAgent: null
}

const LEGACY_SCAN_KEYS = [
  'wcagVersion',
  'wcagLevels',
  'bestPractices',
  'checkLinks',
  'checkSpelling',
  'spellLanguage',
  'checkReadability',
  'runPolicies',
  'diffFromPrevious',
  'notifyEmail'
] as const

/** Deep-merge queue overrides onto site defaults before parseRawConfig. */
export function mergeRawScanConfigs(base: unknown, override: unknown): Record<string, unknown> {
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

export function parseRawConfig(raw: unknown): ParsedScanConfig {
  if (!raw) return { ...DEFAULTS }
  let data: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return { ...DEFAULTS }
    }
  } else if (typeof raw === 'object') {
    data = raw as Record<string, unknown>
  } else {
    return { ...DEFAULTS }
  }

  const merged = {
    ...DEFAULTS,
    ...data,
    auth: { ...DEFAULTS.auth, ...(data.auth as ScanAuthConfig || {}) },
    includePatterns: (data.includePatterns as string[]) ?? DEFAULTS.includePatterns,
    excludePatterns: (data.excludePatterns as string[]) ?? DEFAULTS.excludePatterns,
    pages: (data.pages as string[]) ?? DEFAULTS.pages,
    customHeaders: (data.customHeaders as Record<string, string>) ?? DEFAULTS.customHeaders
  } as ParsedScanConfig

  if (data.mode === 'full' || data.mode === 'pages' || data.mode === 'sitemap') {
    merged.mode = data.mode
  } else {
    merged.mode = DEFAULTS.mode
  }

  merged.maxPages = coercePositiveInt(merged.maxPages, DEFAULTS.maxPages)
  merged.maxDepth = coercePositiveInt(merged.maxDepth, DEFAULTS.maxDepth)
  merged.concurrency = coercePositiveInt(merged.concurrency, DEFAULTS.concurrency, 10)
  merged.timeout = coercePositiveInt(merged.timeout, DEFAULTS.timeout)

  if (merged.waitStrategy === 'delay5s') {
    merged.waitStrategy = 'delay10s'
  }

  for (const key of LEGACY_SCAN_KEYS) {
    delete (merged as unknown as Record<string, unknown>)[key]
  }

  return merged
}

/** Scans always run full accessibility + QA inventory regardless of site target. */
export function deriveScanTypeFromRaw(_raw: unknown): 'full' {
  return 'full'
}

export function configForStorage(config: ParsedScanConfig): Record<string, unknown> {
  return {
    mode: config.mode,
    pages: config.pages,
    sitemapUrl: config.sitemapUrl,
    maxPages: config.maxPages,
    maxDepth: config.maxDepth,
    stayOnDomain: config.stayOnDomain,
    respectRobots: config.respectRobots,
    includePatterns: config.includePatterns,
    excludePatterns: config.excludePatterns,
    viewport: config.viewport,
    waitStrategy: config.waitStrategy,
    concurrency: config.concurrency,
    timeout: config.timeout,
    auth: config.auth,
    customHeaders: config.customHeaders,
    userAgent: config.userAgent
  }
}

/** Strip legacy reporting keys from stored scan config (migration helper). */
export function stripLegacyReportingKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw }
  for (const key of LEGACY_SCAN_KEYS) {
    delete out[key]
  }
  return out
}

export const VIEWPORT_SIZES = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
} as const

export function getWaitUntil(strategy: string): 'load' | 'domcontentloaded' | 'networkidle' {
  if (strategy === 'load' || strategy === 'delay2s' || strategy === 'delay5s' || strategy === 'delay10s') {
    return 'load'
  }
  return 'networkidle'
}

export function getPostLoadDelay(strategy: string): number {
  if (strategy === 'delay2s') return 2000
  if (strategy === 'delay5s' || strategy === 'delay10s') return 10_000
  return 0
}
