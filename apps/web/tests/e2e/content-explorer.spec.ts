import { test, expect, type Page } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL || process.env.APP_USER_EMAIL || 'test-user@sitenook.test'
const PASSWORD = process.env.TEST_USER_PASSWORD || process.env.APP_USER_PASSWORD || 'test-user-password-123'

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

async function selectAllSitesWorkspace(page: Page) {
  const switcher = page.getByRole('button', { name: /switch site/i }).first()
  await expect(switcher).toBeVisible({ timeout: 30_000 })
  await switcher.click()
  await page.getByRole('button', { name: /^all sites$/i }).click()
  await expect(page.getByRole('button', { name: /all sites/i }).first()).toBeVisible({ timeout: 15_000 })
}

test('content explorer shows top-level Content nav and org sites table', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  await selectAllSitesWorkspace(page)

  const contentNav = page.getByRole('navigation').getByRole('link', { name: 'Content', exact: true })
  await expect(contentNav).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Explorer', exact: true })).toHaveCount(0)

  await contentNav.click()
  await expect(page).toHaveURL(/\/content\/explorer/, { timeout: 45_000 })
  await expect(
    page.getByRole('heading', { name: /content explorer/i }).first()
  ).toBeVisible({ timeout: 45_000 })

  await expect(page.getByText('Select a site…')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'All sites', exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/choose a site to browse extracted page content/i)).toBeVisible()
  await expect(page.getByText('Loading sites…')).toHaveCount(0, { timeout: 60_000 })
  const table = page.locator('table')
  await expect(table).toBeVisible({ timeout: 30_000 })
  await expect(table.getByText('Pages', { exact: true })).toBeVisible()
  await expect(table.getByText('Last scanned', { exact: true })).toBeVisible()
})

test('site content explorer shows scan-row actions and external link', async ({ page }) => {
  test.setTimeout(180_000)
  await login(page)
  await selectAllSitesWorkspace(page)

  await page.goto('/content/explorer', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'All sites', exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText('Loading sites…')).toHaveCount(0, { timeout: 60_000 })

  // Prefer a site that already has crawled pages (non-zero Pages column).
  const dataRows = page.locator('table tbody tr')
  await expect(dataRows.first()).toBeVisible({ timeout: 30_000 })
  const rowCount = await dataRows.count()
  let opened = false
  for (let i = 0; i < rowCount; i++) {
    const row = dataRows.nth(i)
    const pagesText = (await row.locator('td').nth(1).innerText()).replace(/,/g, '').trim()
    const pages = Number(pagesText)
    if (Number.isFinite(pages) && pages > 0) {
      await row.click()
      opened = true
      break
    }
  }
  test.skip(!opened, 'No sites with crawled pages available')

  await expect(page).toHaveURL(/\/sites\/[^/]+\/content\/explorer/, { timeout: 45_000 })
  await expect(page.getByLabel('Add prompt to page content')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: /edit prompt/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^copy$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^download( zip)?$/i })).toBeVisible()

  const pageRow = page.locator('ul li').filter({ has: page.getByRole('checkbox') }).first()
  await expect(pageRow).toBeVisible({ timeout: 30_000 })
  await pageRow.locator('button').filter({ has: page.locator('span.truncate') }).first().click()

  const external = page.getByLabel('Open page in new tab')
  await expect(external).toBeVisible({ timeout: 15_000 })
  const href = await external.getAttribute('href')
  expect(href).toMatch(/^https?:\/\//)
})
