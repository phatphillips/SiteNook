import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL || process.env.APP_USER_EMAIL || 'admin@sitenook.local'
const PASSWORD = process.env.TEST_USER_PASSWORD || process.env.APP_USER_PASSWORD || 'changeme_app_password'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

async function gotoRoute(page: Page, path: string) {
  const maxAttempts = 4
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      if (response && response.status() >= 500) {
        throw new Error(`HTTP ${response.status()} for ${path}`)
      }
      return
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await page.waitForTimeout(1_500 * attempt)
      }
    }
  }
  throw lastError
}

async function expectPageReady(page: Page, heading: RegExp | string, timeout = 45_000) {
  await expect(page.getByText('500', { exact: true })).not.toBeVisible({ timeout: 5_000 })
  await expect(
    page.locator('.dashboard-page-navbar h1').filter({ hasText: heading }).first()
  ).toBeVisible({ timeout })
}

test.describe('navigation stress', () => {
  test('browse core routes, paginate, and refresh without hanging', async ({ page }) => {
    test.setTimeout(300_000)

    await login(page)

    await gotoRoute(page, '/sites')
    await expect(page).not.toHaveTitle(/error/i)

    const firstSiteLink = page.locator('a[href^="/sites/"]').first()
    await expect(firstSiteLink).toBeVisible({ timeout: 30_000 })
    const siteHref = await firstSiteLink.getAttribute('href')
    expect(siteHref).toBeTruthy()
    const siteBase = siteHref!.replace(/\/$/, '')
    const siteName = (await firstSiteLink.textContent())?.trim()
    expect(siteName).toBeTruthy()

    const routes: Array<{ path: string, heading: RegExp | string }> = [
      { path: siteBase, heading: siteName! },
      { path: `${siteBase}/accessibility/issues`, heading: 'Issues' },
      { path: `${siteBase}/content/explorer`, heading: /content explorer|explorer/i },
      { path: '/content/explorer', heading: /content explorer|explorer/i },
      { path: `${siteBase}/accessibility/readability`, heading: 'Readability' },
      { path: `${siteBase}/accessibility`, heading: /accessibility/i },
      { path: `${siteBase}/qa/links`, heading: /broken links|links/i },
      { path: '/qa/links', heading: /broken links|links/i },
      { path: '/qa/inventory', heading: /content inventory|inventory/i },
      { path: `${siteBase}/qa/spelling`, heading: /spelling/i },
      { path: `${siteBase}/qa/policies`, heading: /policy matches/i },
      { path: '/qa/policies', heading: /policy matches/i },
      { path: `${siteBase}/seo`, heading: /seo/i },
      { path: `${siteBase}/seo/technical`, heading: /technical seo/i },
      { path: '/seo/technical', heading: /seo technical/i },
      { path: '/scans', heading: /scans/i },
      { path: '/sites', heading: /sites/i }
    ]

    for (let round = 0; round < 2; round++) {
      for (const route of routes) {
        const started = Date.now()
        await gotoRoute(page, route.path)
        await expectPageReady(page, route.heading)
        const elapsed = Date.now() - started
        expect(elapsed).toBeLessThan(60_000)
      }
    }

    await gotoRoute(page, `${siteBase}/accessibility/issues`)
    await expectPageReady(page, 'Issues')

    const pagination = page.getByRole('navigation', { name: /pagination/i })
    if (await pagination.isVisible().catch(() => false)) {
      const pageTwo = pagination.getByRole('button', { name: '2' })
      if (await pageTwo.isVisible().catch(() => false)) {
        await pageTwo.click()
        await expect(page.locator('.data-table-skeleton, table')).toBeVisible({ timeout: 15_000 })
      }
    }

    await gotoRoute(page, `${siteBase}/accessibility/readability`)
    await expectPageReady(page, 'Readability')
    await expect(page.locator('.issues-table-panel, .readability-table-panel, .seo-issues-table-panel, .inventory-table-panel, .data-table-skeleton, table').first())
      .toBeVisible({ timeout: 30_000 })

    for (let i = 0; i < 3; i++) {
      await page.reload()
      await expectPageReady(page, 'Readability')
    }

    await gotoRoute(page, `${siteBase}/accessibility/issues`)
    await expectPageReady(page, 'Issues')
    await gotoRoute(page, `${siteBase}/accessibility/readability`)
    await expectPageReady(page, 'Readability')
    await expect(page.getByRole('heading', { name: 'Issues' })).not.toBeVisible()
  })
})
