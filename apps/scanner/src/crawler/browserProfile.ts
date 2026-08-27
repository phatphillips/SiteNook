import type { BrowserContext } from 'playwright'

/** Chrome-like UA without "HeadlessChrome" (often blocked by WAFs). */
export const DEFAULT_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const DEFAULT_BROWSER_LOCALE = process.env.SCANNER_BROWSER_LOCALE || 'en-AU'

export const DEFAULT_BROWSER_TIMEZONE =
  process.env.SCANNER_TIMEZONE || process.env.SCANNER_BROWSER_TIMEZONE || 'Australia/Hobart'

/**
 * Headers applied via Playwright `extraHTTPHeaders` (every request, including fonts/CSS/images).
 *
 * Do NOT put navigation-only metadata here (`Sec-Fetch-*`, document `Accept`, etc.).
 * Those break Google Fonts / similar CDNs: CSS returns 200 but `.woff2` faces never load,
 * so Material icon ligatures render as text and brand fonts fall back in screenshots.
 */
export const DEFAULT_BROWSER_HEADERS: Record<string, string> = {
  'Accept-Language': 'en-AU,en;q=0.9'
}

/** Headers that must not be forced onto font/CSS/image subrequests. */
const UNSAFE_GLOBAL_HEADER_NAMES = new Set([
  'accept',
  'upgrade-insecure-requests',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'sec-fetch-storage-access'
])

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

/** Drop navigation-only headers that break webfont loading when applied globally. */
export function sanitizeBrowserHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (UNSAFE_GLOBAL_HEADER_NAMES.has(key.toLowerCase())) continue
    out[key] = value
  }
  return out
}

export function mergeBrowserHeaders(
  customHeaders?: Record<string, string>
): Record<string, string> {
  return sanitizeBrowserHeaders({
    ...DEFAULT_BROWSER_HEADERS,
    ...(customHeaders || {})
  })
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
