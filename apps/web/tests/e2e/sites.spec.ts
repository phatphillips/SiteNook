import { test, expect } from '@playwright/test'

test('sites list page loads', async ({ page }) => {
  await page.goto('/sites')
  await expect(page).not.toHaveTitle(/error/i)
})
