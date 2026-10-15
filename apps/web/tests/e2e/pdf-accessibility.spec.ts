import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test-user@sitenook.test')
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD || 'test-user-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).not.toHaveURL('/login')
}

test('pdf validate page renders upload panel when site exists', async ({ page }) => {
  await login(page)
  await page.goto('/sites')
  const firstSiteLink = page.locator('a[href^="/sites/"]').first()
  const href = await firstSiteLink.getAttribute('href')
  if (!href) {
    test.skip()
    return
  }
  await page.goto(`${href}/accessibility/pdfs`)
  await expect(page.getByRole('heading', { name: 'PDF Accessibility' })).toBeVisible()
  await expect(page.getByText('Upload PDFs')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PDFs' })).toBeVisible()
  await expect(page.getByText(/PDF Inspector|assisted fix/i).first()).toBeVisible()
})

test('pdf studio deep link controls are reachable from library when a complete PDF exists', async ({ page }) => {
  await login(page)
  await page.goto('/sites')
  const firstSiteLink = page.locator('a[href^="/sites/"]').first()
  const href = await firstSiteLink.getAttribute('href')
  if (!href) {
    test.skip()
    return
  }
  await page.goto(`${href}/accessibility/pdfs`)
  await expect(page.getByRole('button', { name: /Suggest tags/i })).toBeVisible()

  const openLink = page.locator('a[href*="/accessibility/pdfs/"]').filter({ hasNot: page.locator('[href$="/accessibility/pdfs"]') }).first()
  if (await openLink.count() === 0) {
    test.skip()
    return
  }

  await openLink.click()
  await expect(page).toHaveURL(/\/accessibility\/pdfs\/[^/]+/)

  // Wayfinding: PDFs / PDF Inspector breadcrumb
  const crumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumb.getByRole('link', { name: 'PDFs' })).toBeVisible()
  await expect(crumb.getByText('PDF Inspector')).toBeVisible()
  await expect(crumb.getByText('/', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Review this document in detail/i })).toHaveCount(0)

  // Studio modes + shell landmarks
  await expect(page.getByRole('tab', { name: 'Audit' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Convert' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Before & after' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Generate assisted fix/i })).toHaveCount(0)
  await expect(page.getByLabel('Pages')).toBeVisible()
  await expect(page.getByLabel('Preview')).toBeVisible()

  await page.getByRole('tab', { name: 'Convert' }).click()
  await expect(page).toHaveURL(/mode=convert/)
  await expect(page.getByLabel('Content')).toBeVisible()


  // When preview canvas mounts, it should not stay at the blank default 300×150 size
  const canvas = page.locator('canvas').first()
  if (await canvas.count() > 0) {
    await expect.poll(async () => {
      const box = await canvas.boundingBox()
      return box ? Math.max(box.width, box.height) : 0
    }, { timeout: 15000 }).toBeGreaterThan(200)
  }
})
