import { test, expect } from '@playwright/test'

async function login(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'SiteNook' })).toBeVisible({ timeout: 45000 })
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || 'test-user@sitenook.test')
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD || 'test-user-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('reports page opens and new modal works', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()

  await page.getByRole('button', { name: 'New' }).click()
  await expect(page.getByRole('heading', { name: 'New report' })).toBeVisible()
  await expect(page.getByText('Content')).toBeVisible()
  await expect(page.getByText('Sections')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()

  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Generate now')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate report' })).toBeVisible()
})

test('new modal schedule delivery step', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto('/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()

  await page.getByRole('tab', { name: 'Scheduled' }).click()
  await expect(page.getByText(/No scheduled reports|Next run/i)).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'New' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Schedule')).toBeVisible()
  await page.getByRole('button', { name: 'Schedule' }).click()
  await expect(page.getByText('Recipients')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create schedule' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create schedule' })).toBeDisabled()
})
