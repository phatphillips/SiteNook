import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test-user@accessiq.test')
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
  await expect(page.getByRole('heading', { name: 'PDF accessibility' })).toBeVisible()
  await expect(page.getByText('Upload PDFs')).toBeVisible()
  await expect(page.getByText('Validated PDFs')).toBeVisible()
})
