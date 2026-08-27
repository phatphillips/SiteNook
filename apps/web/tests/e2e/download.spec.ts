import { test, expect } from '@playwright/test'

test.describe('download page', () => {
  test('serves self-host download content when marketing apex is enabled', async ({ page }) => {
    await page.goto('/download')
    // Marketing middleware redirects away when NUXT_PUBLIC_MARKETING_SITE is off.
    if (!page.url().includes('/download')) {
      test.skip(true, 'Marketing site disabled in this environment')
      return
    }
    await expect(page.getByRole('heading', { name: /Run SiteNook on your infrastructure/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Buy Self-host licence/i })).toBeVisible()
  })
})
