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
  wcagVersion: string
  wcagLevels: string[]
  bestPractices: boolean
  checkLinks: boolean
  checkSpelling: boolean
  spellLanguage: string
  checkReadability: boolean
  runPolicies: boolean
  viewport: 'desktop' | 'tablet' | 'mobile'
  waitStrategy: 'load' | 'networkidle' | 'delay2s' | 'delay5s'
  concurrency: number
  timeout: number
  auth: ScanAuthConfig
  diffFromPrevious: boolean
  customHeaders: Record<string, string>
  userAgent: string | null
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
  auth: { type: 'none' },
  diffFromPrevious: true,
  customHeaders: {},
  userAgent: null
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

  return {
    ...DEFAULTS,
    ...data,
    auth: { ...DEFAULTS.auth, ...(data.auth as ScanAuthConfig || {}) },
    includePatterns: (data.includePatterns as string[]) ?? DEFAULTS.includePatterns,
    excludePatterns: (data.excludePatterns as string[]) ?? DEFAULTS.excludePatterns,
    wcagLevels: (data.wcagLevels as string[]) ?? DEFAULTS.wcagLevels,
    pages: (data.pages as string[]) ?? DEFAULTS.pages,
    customHeaders: (data.customHeaders as Record<string, string>) ?? DEFAULTS.customHeaders
  } as ParsedScanConfig
}

export function buildAxeTags(wcagVersion: string, levels: string[], bestPractices: boolean): string[] {
  const versionKey = wcagVersion === '2.0' ? '2' : wcagVersion === '2.1' ? '21' : '22'
  const tags: string[] = []

  for (const level of levels) {
    const l = level.toLowerCase()
    if (versionKey === '2') tags.push(`wcag2${l}`)
    else tags.push(`wcag${versionKey}${l}`)
  }

  if (bestPractices) tags.push('best-practice')
  return tags.length ? tags : ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']
}

export const VIEWPORT_SIZES = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 }
} as const

export function getWaitUntil(strategy: string): 'load' | 'domcontentloaded' | 'networkidle' {
  if (strategy === 'load' || strategy === 'delay2s' || strategy === 'delay5s') return 'load'
  return 'networkidle'
}

export function getPostLoadDelay(strategy: string): number {
  if (strategy === 'delay2s') return 2000
  if (strategy === 'delay5s') return 5000
  return 0
}
