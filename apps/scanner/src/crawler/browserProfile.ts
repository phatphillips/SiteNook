import type { BrowserContext } from 'playwright'

/** Chrome-like UA without "HeadlessChrome" (often blocked by WAFs). */
export const DEFAULT_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DEFAULT_BROWSER_LOCALE = process.env.SCANNER_BROWSER_LOCALE || 'en-AU'

export const DEFAULT_BROWSER_TIMEZONE =
  process.env.SCANNER_TIMEZONE || process.env.SCANNER_BROWSER_TIMEZONE || 'Australia/Hobart'

/** Headers sent on every page navigation (merged under site custom headers). */
export const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
  'Accept-Language': 'en-AU,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1'
}

export const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled'
]

export function resolveUserAgent(configured: string | null | undefined): string {
  const custom = configured?.trim()
  if (custom) return custom
  const fromEnv = process.env.SCANNER_USER_AGENT?.trim()
  if (fromEnv) return fromEnv
  return DEFAULT_BROWSER_USER_AGENT
}

export function mergeBrowserHeaders(
  customHeaders?: Record<string, string>
): Record<string, string> {
  return {
    ...DEFAULT_BROWSER_HEADERS,
    ...(customHeaders || {})
  }
}

export function buildContextOptions(options: {
  customHeaders?: Record<string, string>
  userAgent?: string | null
  httpCredentials?: { username: string, password: string }
}): Record<string, unknown> {
  const extraHTTPHeaders = mergeBrowserHeaders(options.customHeaders)
  const contextOptions: Record<string, unknown> = {
    userAgent: resolveUserAgent(options.userAgent),
    locale: DEFAULT_BROWSER_LOCALE,
    timezoneId: DEFAULT_BROWSER_TIMEZONE,
    extraHTTPHeaders
  }
  if (options.httpCredentials) {
    contextOptions.httpCredentials = options.httpCredentials
  }
  return contextOptions
}

/** Reduce trivial bot signals (navigator.webdriver, etc.). */
export async function applyStealthInitScript(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    // tsx/esbuild injects __name() when serializing named functions for page.evaluate().
    const g = globalThis as typeof globalThis & { __name?: (target: unknown) => unknown }
    g.__name = (target) => target
  })
}
