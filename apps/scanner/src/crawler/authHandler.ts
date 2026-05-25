import type { BrowserContext, Page } from 'playwright'
import type { ScanAuthConfig } from '../config/scanConfig.js'

export interface AuthContextOptions {
  auth: ScanAuthConfig
  customHeaders?: Record<string, string>
  userAgent?: string | null
}

export async function createAuthenticatedContext(
  browser: { newContext: (opts?: object) => Promise<BrowserContext> },
  options: AuthContextOptions
): Promise<BrowserContext> {
  const headers = { ...(options.customHeaders || {}) }

  if (options.auth.type === 'bearer' && options.auth.token) {
    headers.Authorization = `Bearer ${options.auth.token}`
  }

  const contextOptions: Record<string, unknown> = {}
  if (Object.keys(headers).length) {
    contextOptions.extraHTTPHeaders = headers
  }
  if (options.userAgent) {
    contextOptions.userAgent = options.userAgent
  }
  if (options.auth.type === 'basic' && options.auth.username) {
    contextOptions.httpCredentials = {
      username: options.auth.username,
      password: options.auth.password || ''
    }
  }

  const context = await browser.newContext(contextOptions)

  if (options.auth.type === 'cookie' && options.auth.cookieString) {
    const cookies = parseCookieString(options.auth.cookieString)
    if (cookies.length) {
      await context.addCookies(cookies)
    }
  }

  return context
}

export async function applyFormAuth(page: Page, auth: ScanAuthConfig): Promise<void> {
  if (auth.type !== 'form' || !auth.loginUrl) return

  await page.goto(auth.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

  const userSel = auth.usernameSelector || 'input[type=email], input[name=email]'
  const passSel = auth.passwordSelector || 'input[type=password]'
  const submitSel = auth.submitSelector || 'button[type=submit]'

  if (auth.username) await page.fill(userSel, auth.username)
  if (auth.password) await page.fill(passSel, auth.password)
  await page.click(submitSel)
  await page.waitForLoadState('networkidle').catch(() => {})
}

function parseCookieString(cookieString: string) {
  return cookieString
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=')
      if (eq === -1) return null
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      if (!name) return null
      return {
        name,
        value,
        domain: '',
        path: '/'
      }
    })
    .filter((c): c is { name: string, value: string, domain: string, path: string } => !!c)
}
